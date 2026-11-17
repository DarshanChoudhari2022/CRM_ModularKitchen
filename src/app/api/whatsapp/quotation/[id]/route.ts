import { NextResponse } from "next/server";
import { canRead } from "@/domain/commands";
import { loadWorkspace } from "@/lib/server/repository";
import { APIError, context } from "@/lib/server/supabase";
import { failure } from "@/lib/server/http";
import { isWhatsAppConfigured } from "@/lib/whatsapp/config";
import {
  getContact,
  getFollowupsForQuotation,
  getMessagesForQuotation,
} from "@/lib/whatsapp/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("WhatsApp is unavailable in demo mode.", 503);
    const ctx = await context();
    if (!canRead(ctx.actor.role, "quote"))
      throw new APIError("Quotation not found.", 404);
    const { id } = await params;
    const workspace = await loadWorkspace(ctx.organizationId);
    const quote = workspace.records.find(
      (record) => record.kind === "quote" && record.id === id,
    );
    if (!quote) throw new APIError("Quotation not found.", 404);
    const [messages, followups, contact] = await Promise.all([
      getMessagesForQuotation(ctx.organizationId, id),
      getFollowupsForQuotation(ctx.organizationId, id),
      quote.customerId
        ? getContact(ctx.organizationId, quote.customerId)
        : Promise.resolve(null),
    ]);
    return NextResponse.json(
      {
        configured: isWhatsAppConfigured(),
        templateName: process.env.WHATSAPP_QUOTE_TEMPLATE_NAME || null,
        templateLanguage: process.env.WHATSAPP_QUOTE_TEMPLATE_LANGUAGE || null,
        messages,
        followups,
        contact,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
