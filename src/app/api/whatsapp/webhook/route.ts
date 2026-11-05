import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/server/http";
import { APIError, sessionClient } from "@/lib/server/supabase";
import {
  parseWebhook,
} from "@/lib/whatsapp/service";
import type { WhatsAppMessageStatus } from "@/lib/whatsapp/types";
import {
  updateContactOptIn,
  getOrCreateContact,
  createMessage,
  updateMessageStatus,
  getMessageByProviderId,
  saveWebhookEvent,
} from "@/lib/whatsapp/repository";

const verifySchema = z.object({
  "hub.mode": z.string(),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = verifySchema.parse({
      "hub.mode": url.searchParams.get("hub.mode"),
      "hub.verify_token": url.searchParams.get("hub.verify_token"),
      "hub.challenge": url.searchParams.get("hub.challenge"),
    });

    const token = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!token) throw new APIError("WhatsApp verify token not configured.", 503);

    if (params["hub.mode"] === "subscribe" && params["hub.verify_token"] === token) {
      return new Response(params["hub.challenge"], {
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Verification failed", { status: 403 });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("WhatsApp webhooks are disabled in demo mode.", 503);

    const raw = await request.text();
    if (raw.length > 500000) throw new APIError("Webhook too large.", 413);

    // Verify Meta signature if app secret is configured
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret && signature) {
      const expected = await verifyHmac(raw, signature, appSecret);
      if (!expected) throw new APIError("Invalid webhook signature.", 401);
    }

    const body = JSON.parse(raw) as unknown;
    const entry = parseWebhook(body);
    if (!entry) throw new APIError("Invalid WhatsApp webhook payload.", 400);

    // Determine organization from the phone number ID in metadata
    // In a single-tenant CRM, we can use a default org or look it up
    const organizationId = process.env.INTEGRATION_ORGANIZATION_ID;
    if (!organizationId)
      throw new APIError("Integration organization is not configured.", 503);

    for (const e of entry.entry) {
      for (const change of e.changes) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        // Process message statuses (sent, delivered, read, failed)
        for (const status of value.statuses ?? []) {
          await processStatusUpdate(
            organizationId,
            phoneNumberId,
            status,
          );
        }

        // Process inbound messages
        for (const message of value.messages ?? []) {
          await processInboundMessage(
            organizationId,
            phoneNumberId,
            message,
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    return failure(e);
  }
}

async function processStatusUpdate(
  organizationId: string,
  phoneNumberId: string | undefined,
  status: { id: string; status: string; timestamp: string; recipient_id?: string; conversation?: { id?: string }; pricing?: unknown; errors?: Array<{ code?: string; title?: string }> },
) {
  const providerMessageId = status.id;
  if (!providerMessageId) return;

  const conversationId = status.conversation?.id;
  const eventType = `message_status_${status.status}`;

  // Save webhook event for audit/dedup
  try {
    await saveWebhookEvent(organizationId, providerMessageId, eventType, {
      status: status.status,
      timestamp: status.timestamp,
      recipientId: status.recipient_id,
      conversationId,
      pricing: status.pricing,
      errors: status.errors,
      phoneNumberId,
    });
  } catch {
    // Duplicate event - ignore (idempotency)
  }

  // Find existing message by provider ID
  const message = await getMessageByProviderId(organizationId, providerMessageId);
  if (!message) return;

  // Update message status
  const updates: Record<string, unknown> = {
    status: status.status as WhatsAppMessageStatus,
    updated_at: new Date().toISOString(),
  };
  if (status.status === "sent") updates.sent_at = status.timestamp;
  if (status.status === "delivered") updates.delivered_at = status.timestamp;
  if (status.status === "read") updates.read_at = status.timestamp;
  if (status.errors?.length) {
    updates.error_code = status.errors[0].code;
    updates.error_message = status.errors[0].title;
  }

  await updateMessageStatus(message.id, updates);
}

async function processInboundMessage(
  organizationId: string,
  phoneNumberId: string | undefined,
  message: { from: string; id: string; timestamp: string; type: string; text?: { body?: string }; document?: unknown },
) {
  const from = message.from;
  const messageId = message.id;
  const timestamp = message.timestamp;
  const messageType = message.type;

  // Save webhook event
  try {
    await saveWebhookEvent(organizationId, messageId, `message_inbound_${messageType}`, {
      from,
      timestamp,
      type: messageType,
      text: message.text?.body,
      document: message.document,
      phoneNumberId,
    });
  } catch {
    // Duplicate - ignore
  }

  // Find or create contact by phone number
  const client = await sessionClient();
  const { data: records, error } = await client
    .from("crm_records")
    .select("data")
    .eq("organization_id", organizationId)
    .eq("kind", "customer")
    .eq("data->>'phone'", from);

  if (error || !records?.length) {
    return;
  }

  const customer = records[0].data as unknown as { id: string };
  const customerId = customer.id;

  // Update contact opt-in status - inbound message implies consent
  try {
    await updateContactOptIn(organizationId, customerId, "opted_in", "whatsapp_inbound");
  } catch {
    try {
      await getOrCreateContact(organizationId, customerId, from);
      await updateContactOptIn(organizationId, customerId, "opted_in", "whatsapp_inbound");
    } catch {
      // Non-fatal
    }
  }

  // Record inbound message linked to any recent quotation for this customer
  const { data: quotes, error: qError } = await client
    .from("crm_records")
    .select("data")
    .eq("organization_id", organizationId)
    .eq("kind", "quote")
    .eq("data->>'customerId'", customerId)
    .order("data->>'updatedAt'", { ascending: false })
    .limit(5);

  if (!qError && quotes?.length) {
    const latestQuote = quotes[0].data as unknown as { id: string };
    await createMessage(organizationId, {
      quotationId: latestQuote.id,
      customerId,
      phoneNumber: from,
      direction: "inbound",
      messageType: messageType as "document" | "template" | "text" | "media",
      templateName: undefined,
    });
  }
}

async function verifyHmac(raw: string, signature: string, appSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const messageData = encoder.encode(raw);

  // Use Web Crypto API (available in Next.js edge/runtime)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  return hashHex === provided;
}
