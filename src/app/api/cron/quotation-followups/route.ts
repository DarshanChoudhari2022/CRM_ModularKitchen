import { NextResponse } from "next/server";
import { APIError } from "@/lib/server/supabase";
import { failure } from "@/lib/server/http";
import { loadWorkspace } from "@/lib/server/repository";
import { authorizedSecret } from "@/lib/integrations/verification";
import { documentTotal } from "@/domain/pricing";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import {
  claimDueFollowups,
  finishClaimedFollowup,
  getContact,
  getMessagesForQuotation,
  customerHasRepliedSince,
  createMessage,
  updateMessageStatus,
} from "@/lib/whatsapp/repository";
import { sendTemplateMessage } from "@/lib/whatsapp/service";
import type { QuotationFollowup } from "@/lib/whatsapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const normalizePhone = (phone: string) => phone.replace(/[\s()+-]/g, "");

function contactHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(date),
  );
}

async function processFollowup(
  followup: QuotationFollowup,
  templateName: string,
  language: string,
): Promise<"sent" | "skipped" | "unknown"> {
  let messageId: string | undefined;
  const skip = async (reason: string): Promise<"skipped"> => {
    await finishClaimedFollowup(followup, "skipped", { skipReason: reason });
    return "skipped";
  };
  try {
    const workspace = await loadWorkspace(followup.organizationId);
    const quote = workspace.records.find(
      (record) => record.kind === "quote" && record.id === followup.quotationId,
    );
    const customer = workspace.records.find(
      (record) => record.kind === "customer" && record.id === followup.customerId,
    );
    if (!quote || quote.customerId !== followup.customerId || quote.status !== "Shared")
      return skip("Quotation is no longer shared and awaiting customer response.");
    if (!customer || !customer.consent)
      return skip("Customer consent is absent or has been revoked.");
    const phone = normalizePhone(customer.phone ?? "");
    if (!/^[1-9]\d{7,14}$/.test(phone))
      return skip("Customer no longer has a valid international phone number.");
    const contact = await getContact(followup.organizationId, customer.id);
    if (contact?.optInStatus === "opted_out")
      return skip("Customer opted out of WhatsApp messages.");
    if (contact && normalizePhone(contact.phoneNumber) !== phone)
      return skip("Customer WhatsApp number changed after initial quotation.");
    const messages = await getMessagesForQuotation(followup.organizationId, quote.id);
    const initial = messages.find((message) => message.direction === "outbound");
    if (!initial || !["sent", "delivered", "read"].includes(initial.status) || !initial.sentAt)
      return skip("Initial quotation delivery is not confirmed.");
    if (normalizePhone(initial.phoneNumber) !== phone)
      return skip("Customer phone number changed after initial quotation.");
    if (
      (contact?.lastInboundMessageAt &&
        new Date(contact.lastInboundMessageAt).getTime() >= new Date(initial.sentAt).getTime()) ||
      (await customerHasRepliedSince(followup.organizationId, customer.id, initial.sentAt))
    )
      return skip("Customer replied after receiving the quotation.");

    // Persist intent before the external request. Unknown outcomes never return to the queue.
    const message = await createMessage(followup.organizationId, {
      quotationId: quote.id,
      customerId: customer.id,
      phoneNumber: phone,
      direction: "outbound",
      messageType: "template",
      templateName,
      followupId: followup.id,
    });
    messageId = message.id;

    // Recheck mutable policy immediately before Meta submission.
    const latestWorkspace = await loadWorkspace(followup.organizationId);
    const latestQuote = latestWorkspace.records.find((record) => record.kind === "quote" && record.id === quote.id);
    const latestCustomer = latestWorkspace.records.find((record) => record.kind === "customer" && record.id === customer.id);
    const latestContact = await getContact(followup.organizationId, customer.id);
    if (
      latestQuote?.status !== "Shared" || latestQuote.customerId !== customer.id ||
      !latestCustomer?.consent || normalizePhone(latestCustomer.phone ?? "") !== phone ||
      latestContact?.optInStatus === "opted_out" ||
      (latestContact?.lastInboundMessageAt && new Date(latestContact.lastInboundMessageAt).getTime() >= new Date(initial.sentAt).getTime()) ||
      (await customerHasRepliedSince(followup.organizationId, customer.id, initial.sentAt))
    ) {
      await updateMessageStatus(message.id, { status: "failed", errorMessage: "Eligibility changed before submission." });
      return skip("Eligibility changed before provider submission.");
    }
    const result = await sendTemplateMessage(phone, templateName, language, [
      { type: "text", text: latestCustomer.name },
      { type: "text", text: latestQuote.number ?? latestQuote.id },
      { type: "text", text: documentTotal(latestQuote) },
    ]);
    if (!result.providerMessageId)
      throw new Error("Provider acknowledgement had no message ID.");
    await updateMessageStatus(message.id, {
      status: "sent",
      providerMessageId: result.providerMessageId,
      sentAt: new Date().toISOString(),
    });
    await finishClaimedFollowup(followup, "sent", {
      providerMessageId: result.providerMessageId,
    });
    return "sent";
  } catch {
    if (messageId) {
      try { await updateMessageStatus(messageId, { status: "unknown" }); } catch { /* Pending also blocks retry. */ }
    }
    await finishClaimedFollowup(followup, "unknown", {
      lastError: "Submission outcome is uncertain. Reconcile with Meta before any retry.",
    });
    return "unknown";
  }
}

export async function GET(request: Request) {
  try {
    if (!authorizedSecret(request.headers.get("authorization"), process.env.CRON_SECRET))
      throw new APIError("Unauthorized scheduler.", 401);
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("External dispatch is disabled in demo mode.", 503);
    if (!isWhatsAppConfigured())
      throw new APIError("WhatsApp is not configured.", 503);
    const organizationId = process.env.INTEGRATION_ORGANIZATION_ID;
    const templateName = process.env.WHATSAPP_FOLLOWUP_TEMPLATE_NAME;
    const language = process.env.WHATSAPP_QUOTE_TEMPLATE_LANGUAGE ?? "en";
    if (!organizationId || !templateName)
      throw new APIError("Follow-up integration is not configured.", 503);
    const hour = contactHour(new Date());
    if (hour < 9 || hour >= 19)
      return NextResponse.json({ processed: 0, reason: "Outside India business contact hours." });
    const claimed = await claimDueFollowups(organizationId, 3);
    const results = { sent: 0, skipped: 0, unknown: 0 };
    for (const followup of claimed)
      results[await processFollowup(followup, templateName, language)]++;
    return NextResponse.json({ processed: claimed.length, ...results });
  } catch (error) {
    return failure(error);
  }
}
