import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, readJSON } from "@/lib/server/http";
import { APIError, sessionClient, admin } from "@/lib/server/supabase";
import { commitCommand } from "@/lib/server/repository";
import type { Actor } from "@/domain/types";
import {
  uploadMedia,
  sendDocumentMessage,
  sendTemplateMessage,
  WhatsAppApiError,
} from "@/lib/whatsapp/service";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import {
  getOrCreateContact,
  createMessage,
  updateMessageStatus,
  createFollowup,
} from "@/lib/whatsapp/repository";

const sendSchema = z.object({
  quotationId: z.string().min(1).max(100),
  customerId: z.string().min(1).max(100),
  phoneNumber: z.string().min(1).max(30),
  templateName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("WhatsApp sending is disabled in demo mode.", 503);

    if (!isWhatsAppConfigured())
      throw new APIError(
        "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        503,
      );

    const input = sendSchema.parse(await readJSON(request));

    const client = await sessionClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new APIError("Sign in to continue.", 401);

    const { data: membership } = await admin()
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || !["owner", "estimator", "sales", "accounts"].includes(membership.role))
      throw new APIError("Insufficient permissions to send quotations.", 403);

    const organizationId = membership.organization_id;
    const actor: Actor = { userId: user.id, role: membership.role };

    // Load the quotation record
    const { data: records } = await client
      .from("crm_records")
      .select("data")
      .eq("organization_id", organizationId)
      .eq("kind", "quote")
      .eq("data->>'id'", input.quotationId)
      .maybeSingle();

    if (!records?.data) throw new APIError("Quotation not found.", 404);

    const quote = records.data as unknown as {
      id: string;
      customerId: string;
      status: string;
      number?: string;
      name?: string;
      amount?: string;
      files?: Array<{ path: string }>;
      attachmentPath?: string;
      _revision?: number;
    };
    if (quote.customerId !== input.customerId)
      throw new APIError("Customer does not match the quotation.", 400);

    // Check if quote is sendable
    if (quote.status === "sent" || quote.status === "accepted")
      throw new APIError("Quotation is already sent or accepted.", 400);

    // Get or create contact
    let contact;
    try {
      contact = await getOrCreateContact(organizationId, input.customerId, input.phoneNumber);
    } catch {
      // Continue; contact will be created on first use
    }

    // Determine if we can send free-form or need a template
    const canSendFreeForm = contact?.optInStatus === "opted_in";
    const templateName = input.templateName;

    // Get the PDF object key from the quote record
    const pdfObjectKey = quote.files?.[0]?.path || quote.attachmentPath;
    if (!pdfObjectKey) throw new APIError("No PDF found for this quotation. Generate one first.", 400);

    let providerMessageId: string;
    let messageType: "document" | "template" = "document";

    if (!canSendFreeForm && !templateName) {
      throw new APIError(
        "Customer has not opted in. Use an approved template or collect consent first.",
        403,
      );
    }

    if (templateName && !canSendFreeForm) {
      // Send template message (outside 24h window or no opt-in)
      const result = await sendTemplateMessage(
        input.phoneNumber,
        templateName,
        "en",
        [
          { type: "text", text: quote.customerId || "Customer" },
          { type: "text", text: quote.number || input.quotationId },
          { type: "text", text: quote.amount || "0" },
        ],
      );
      providerMessageId = result.providerMessageId;
      messageType = "template";
    } else {
      // Upload PDF and send as document message
      // Fetch PDF from storage
      const { data: fileData, error: fileError } = await client.storage
        .from("crm-private")
        .download(pdfObjectKey);

      if (fileError || !fileData) throw new APIError("Could not retrieve PDF from storage.", 500);

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const mediaId = await uploadMedia(buffer, pdfObjectKey.split("/").pop() ?? "quotation.pdf", "application/pdf");

      const result = await sendDocumentMessage(
        input.phoneNumber,
        mediaId,
        `Quotation ${quote.number || input.quotationId} from ${quote.name || "your kitchen partner"}.`,
        `quotation-${quote.number || input.quotationId}.pdf`,
      );
      providerMessageId = result.providerMessageId;
      messageType = "document";
    }

    // Create the WhatsApp message record
    const message = await createMessage(organizationId, {
      quotationId: input.quotationId,
      customerId: input.customerId,
      phoneNumber: input.phoneNumber,
      direction: "outbound",
      messageType,
      templateName,
      pdfObjectKey,
    });

    // Update message with provider ID and sent status
    await updateMessageStatus(message.id, {
      status: "sent",
      providerMessageId,
      sentAt: new Date().toISOString(),
    });

    // Update quotation status to "sent" via domain command
    try {
      await commitCommand(
        organizationId,
        actor,
        {
          type: "transition",
          id: input.quotationId,
          status: "sent",
          evidence: `Sent via WhatsApp to ${input.phoneNumber} (message ${providerMessageId})`,
        },
        quote._revision ?? 0,
      );
    } catch {
      // If revision conflict, the message is still recorded; quote status update can be retried
    }

    // Schedule a next-day follow-up (per blueprint: one next-day follow-up)
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + 1);
    followupDate.setHours(10, 0, 0, 0); // 10 AM local time

    try {
      await createFollowup(organizationId, {
        quotationId: input.quotationId,
        customerId: input.customerId,
        scheduledAt: followupDate.toISOString(),
      });
    } catch {
      // Non-fatal: follow-up scheduling failure shouldn't block the send
    }

    return NextResponse.json({
      ok: true,
      messageId: message.id,
      providerMessageId,
      status: "sent",
    });
  } catch (e) {
    if (e instanceof WhatsAppApiError) {
      return NextResponse.json(
        { error: e.message, providerCode: e.providerCode },
        { status: e.status },
      );
    }
    return failure(e);
  }
}
