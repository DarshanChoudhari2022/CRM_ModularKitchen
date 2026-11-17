import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { z } from "zod";
import { assertOrigin, failure, readJSON } from "@/lib/server/http";
import { APIError, context } from "@/lib/server/supabase";
import { commitCommand, loadWorkspace } from "@/lib/server/repository";
import { canWrite } from "@/domain/commands";
import { businessDate, documentTotal } from "@/domain/pricing";
import {
  FinancialDocument,
  registerDocumentFonts,
} from "@/lib/documents/document";
import { numberPDF } from "@/lib/documents/page-numbers";
import {
  uploadMedia,
  sendDocumentMessage,
  sendDocumentTemplateMessage,
} from "@/lib/whatsapp/service";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import {
  getContact,
  getMessagesForQuotation,
  createMessage,
  updateMessageStatus,
  createFollowup,
} from "@/lib/whatsapp/repository";

export const runtime = "nodejs";
const sendSchema = z
  .object({
    quotationId: z.string().min(1).max(100),
    customerId: z.string().min(1).max(100),
    phoneNumber: z.string().min(1).max(30),
  })
  .strict();
const normalizePhone = (phone: string) => phone.replace(/[\s()+-]/g, "");

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { organizationId, actor } = await context();
    if (!canWrite(actor.role, "quote"))
      throw new APIError("Insufficient permissions to send quotations.", 403);
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("WhatsApp sending is disabled in demo mode.", 503);
    if (!isWhatsAppConfigured())
      throw new APIError("WhatsApp is not configured.", 503);
    const input = sendSchema.parse(await readJSON(request));
    let workspace = await loadWorkspace(organizationId);
    let quote = workspace.records.find(
      (r) => r.kind === "quote" && r.id === input.quotationId,
    );
    if (!quote) throw new APIError("Quotation not found.", 404);
    if (quote.customerId !== input.customerId)
      throw new APIError("Customer does not match the quotation.");
    if (!["Draft", "Shared"].includes(quote.status))
      throw new APIError("Only draft or shared quotations can be sent.");
    const customerId = quote.customerId;
    const customer = workspace.records.find(
      (r) => r.kind === "customer" && r.id === customerId,
    );
    const phone = normalizePhone(customer?.phone ?? "");
    if (
      !customer ||
      !/^[1-9]\d{7,14}$/.test(phone) ||
      phone !== normalizePhone(input.phoneNumber)
    )
      throw new APIError(
        "Use the quotation customer's saved international phone number.",
      );
    const contact = await getContact(organizationId, customer.id);
    if (!customer.consent || contact?.optInStatus === "opted_out")
      throw new APIError(
        "Recorded customer permission is required before sending.",
        403,
      );
    const windowOpen =
      !!contact &&
      normalizePhone(contact.phoneNumber) === phone &&
      new Date(contact.serviceWindowExpiresAt ?? "").getTime() > Date.now();
    const templateName = process.env.WHATSAPP_QUOTE_TEMPLATE_NAME?.trim();
    const templateLanguage = process.env.WHATSAPP_QUOTE_TEMPLATE_LANGUAGE?.trim() || "en";
    if (!windowOpen && !templateName)
      throw new APIError(
        "The service window is closed and the quotation document template is not configured.",
        503,
      );
    const existing = await getMessagesForQuotation(organizationId, quote.id);
    if (
      existing.some((m) => m.direction === "outbound" && m.status !== "failed")
    )
      throw new APIError(
        "This quotation already has a submitted or unresolved message. Reconcile before retrying.",
        409,
      );

    // Freeze authoritative rates, terms and billing identity before external submission.
    if (quote.status === "Draft") {
      workspace = await commitCommand(
        organizationId,
        actor,
        { type: "transition", id: quote.id, status: "Shared" },
        workspace.revision,
      );
      quote = workspace.records.find((r) => r.id === input.quotationId)!;
    }
    const messageType = windowOpen ? "document" : "template";
    const filename = `quotation-${quote.number ?? quote.id}.pdf`;
    registerDocumentFonts(path.join(process.cwd(), "public", "fonts"));
    const bytes = await renderToBuffer(
      FinancialDocument({ record: quote, settings: workspace.settings, customer }),
    );
    const numbered = await numberPDF(bytes);
    const mediaId = await uploadMedia(Buffer.from(numbered), filename, "application/pdf");
    if (!mediaId) throw new APIError("Media upload returned no identifier.", 502);
    // Persist intent first. A crash leaves a pending record that blocks blind retries.
    const message = await createMessage(organizationId, {
      quotationId: quote.id,
      customerId: customer.id,
      phoneNumber: phone,
      direction: "outbound",
      messageType,
      templateName: messageType === "template" ? templateName : undefined,
    });
    let providerMessageId: string;
    try {
      const result =
        messageType === "template"
          ? await sendDocumentTemplateMessage(phone, templateName!, templateLanguage, mediaId, filename, [
              { type: "text", text: customer.name },
              { type: "text", text: quote.number ?? quote.id },
              { type: "text", text: documentTotal(quote) },
            ])
          : await sendDocumentMessage(
              phone,
              mediaId,
              `Quotation ${quote.number ?? quote.id}`,
              filename,
            );
      providerMessageId = result.providerMessageId;
      if (!providerMessageId)
        throw new Error("Missing provider acknowledgement");
      const recorded = await updateMessageStatus(message.id, {
        status: "sent",
        providerMessageId,
        sentAt: new Date().toISOString(),
      });
      if (!recorded) throw new Error("Message outcome could not be saved");
    } catch {
      // Never interpret a timeout or persistence failure as proof that nothing was sent.
      try {
        await updateMessageStatus(message.id, { status: "unknown" });
      } catch {
        /* Pending also blocks retries. */
      }
      return NextResponse.json(
        {
          error:
            "Submission outcome is uncertain. Reconcile with the provider before retrying.",
          messageId: message.id,
          status: "unknown",
        },
        { status: 502 },
      );
    }
    // Next calendar day at 10:00 India time, independent of the server timezone.
    const tomorrow = new Date(`${businessDate()}T00:00:00+05:30`);
    tomorrow.setTime(tomorrow.getTime() + 86400000 + 10 * 3600000);
    let followupScheduled = true;
    try {
      await createFollowup(organizationId, {
        quotationId: quote.id,
        customerId: customer.id,
        scheduledAt: tomorrow.toISOString(),
      });
    } catch {
      followupScheduled = false;
    }
    return NextResponse.json({
      ok: true,
      messageId: message.id,
      providerMessageId,
      status: "sent",
      followupScheduled,
    });
  } catch (error) {
    return failure(error);
  }
}
