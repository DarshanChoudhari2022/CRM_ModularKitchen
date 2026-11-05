import "server-only";
import { admin, APIError } from "@/lib/server/supabase";
import type {
  WhatsAppContact,
  WhatsAppMessage,
  QuotationFollowup,
  WhatsAppOptInStatus,
  WhatsAppMessageStatus,
  FollowupStatus,
} from "./types";

function toContact(row: Record<string, unknown>): WhatsAppContact {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    customerId: String(row.customer_id),
    phoneNumber: String(row.phone_number),
    optInStatus: row.opt_in_status as WhatsAppOptInStatus,
    optInSource: row.opt_in_source as string | undefined,
    optedInAt: row.opted_in_at as string | undefined,
    optedOutAt: row.opted_out_at as string | undefined,
    lastInboundMessageAt: row.last_inbound_message_at as string | undefined,
    serviceWindowExpiresAt: row.service_window_expires_at as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toMessage(row: Record<string, unknown>): WhatsAppMessage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    customerId: String(row.customer_id),
    phoneNumber: String(row.phone_number),
    providerMessageId: row.provider_message_id as string | undefined,
    direction: row.direction as "outbound" | "inbound",
    messageType: row.message_type as "document" | "template" | "text" | "media",
    templateName: row.template_name as string | undefined,
    status: row.status as WhatsAppMessageStatus,
    errorCode: row.error_code as string | undefined,
    errorMessage: row.error_message as string | undefined,
    sentAt: row.sent_at as string | undefined,
    deliveredAt: row.delivered_at as string | undefined,
    readAt: row.read_at as string | undefined,
    mediaObjectKey: row.media_object_key as string | undefined,
    pdfObjectKey: row.pdf_object_key as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toFollowup(row: Record<string, unknown>): QuotationFollowup {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    quotationId: String(row.quotation_id),
    customerId: String(row.customer_id),
    scheduledAt: String(row.scheduled_at),
    status: row.status as FollowupStatus,
    attempts: Number(row.attempts),
    completedAt: row.completed_at as string | undefined,
    lastError: row.last_error as string | undefined,
    skipReason: row.skip_reason as string | undefined,
    bullJobId: row.bull_job_id as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getOrCreateContact(
  organizationId: string,
  customerId: string,
  phoneNumber: string,
): Promise<WhatsAppContact> {
  const { data: existing } = await admin()
    .from("whatsapp_contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) {
    if (existing.phone_number !== phoneNumber) {
      const { data, error } = await admin()
        .from("whatsapp_contacts")
        .update({ phone_number: phoneNumber, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new APIError(error.message, 500);
      return toContact(data);
    }
    return toContact(existing);
  }

  const { data, error } = await admin()
    .from("whatsapp_contacts")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      phone_number: phoneNumber,
      opt_in_status: "unknown",
    })
    .select()
    .single();
  if (error) throw new APIError(error.message, 500);
  return toContact(data);
}

export async function updateContactOptIn(
  organizationId: string,
  customerId: string,
  status: WhatsAppOptInStatus,
  source?: string,
): Promise<WhatsAppContact> {
  const updates: Record<string, unknown> = {
    opt_in_status: status,
    updated_at: new Date().toISOString(),
  };
  if (source) updates.opt_in_source = source;
  if (status === "opted_in") updates.opted_in_at = new Date().toISOString();
  if (status === "opted_out") updates.opted_out_at = new Date().toISOString();

  const { data, error } = await admin()
    .from("whatsapp_contacts")
    .update(updates)
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .select()
    .single();
  if (error) throw new APIError(error.message, 500);
  return toContact(data);
}

export async function getContact(
  organizationId: string,
  customerId: string,
): Promise<WhatsAppContact | null> {
  const { data, error } = await admin()
    .from("whatsapp_contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new APIError(error.message, 500);
  if (!data) return null;
  return toContact(data);
}

export async function createMessage(
  organizationId: string,
  input: {
    quotationId: string;
    customerId: string;
    phoneNumber: string;
    direction: "outbound" | "inbound";
    messageType: "document" | "template" | "text" | "media";
    templateName?: string;
    pdfObjectKey?: string;
    mediaObjectKey?: string;
  },
): Promise<WhatsAppMessage> {
  const { data, error } = await admin()
    .from("whatsapp_messages")
    .insert({
      organization_id: organizationId,
      quotation_id: input.quotationId,
      customer_id: input.customerId,
      phone_number: input.phoneNumber,
      direction: input.direction,
      message_type: input.messageType,
      template_name: input.templateName,
      status: "pending",
      pdf_object_key: input.pdfObjectKey,
      media_object_key: input.mediaObjectKey,
    })
    .select()
    .single();
  if (error) throw new APIError(error.message, 500);
  return toMessage(data);
}

export async function updateMessageStatus(
  messageId: string,
  updates: {
    status?: WhatsAppMessageStatus;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    sentAt?: string;
    deliveredAt?: string;
    readAt?: string;
  },
): Promise<WhatsAppMessage | null> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) fields.status = updates.status;
  if (updates.providerMessageId !== undefined) fields.provider_message_id = updates.providerMessageId;
  if (updates.errorCode !== undefined) fields.error_code = updates.errorCode;
  if (updates.errorMessage !== undefined) fields.error_message = updates.errorMessage;
  if (updates.sentAt) fields.sent_at = updates.sentAt;
  if (updates.deliveredAt) fields.delivered_at = updates.deliveredAt;
  if (updates.readAt) fields.read_at = updates.readAt;

  const { data, error } = await admin()
    .from("whatsapp_messages")
    .update(fields)
    .eq("id", messageId)
    .select()
    .maybeSingle();
  if (error) throw new APIError(error.message, 500);
  if (!data) return null;
  return toMessage(data);
}

export async function getMessageByProviderId(
  organizationId: string,
  providerMessageId: string,
): Promise<WhatsAppMessage | null> {
  const { data, error } = await admin()
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (error) throw new APIError(error.message, 500);
  if (!data) return null;
  return toMessage(data);
}

export async function getMessagesForQuotation(
  organizationId: string,
  quotationId: string,
): Promise<WhatsAppMessage[]> {
  const { data, error } = await admin()
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: true });
  if (error) throw new APIError(error.message, 500);
  return (data ?? []).map(toMessage);
}

export async function createFollowup(
  organizationId: string,
  input: {
    quotationId: string;
    customerId: string;
    scheduledAt: string;
  },
): Promise<QuotationFollowup> {
  const { data, error } = await admin()
    .from("quotation_followups")
    .insert({
      organization_id: organizationId,
      quotation_id: input.quotationId,
      customer_id: input.customerId,
      scheduled_at: input.scheduledAt,
      status: "scheduled",
      attempts: 0,
    })
    .select()
    .single();
  if (error) throw new APIError(error.message, 500);
  return toFollowup(data);
}

export async function getFollowupsForQuotation(
  organizationId: string,
  quotationId: string,
): Promise<QuotationFollowup[]> {
  const { data, error } = await admin()
    .from("quotation_followups")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("quotation_id", quotationId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new APIError(error.message, 500);
  return (data ?? []).map(toFollowup);
}

export async function getDueFollowups(
  organizationId: string,
  limit: number = 10,
): Promise<QuotationFollowup[]> {
  const { data, error } = await admin()
    .from("quotation_followups")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw new APIError(error.message, 500);
  return (data ?? []).map(toFollowup);
}

export async function updateFollowupStatus(
  followupId: string,
  updates: {
    status?: FollowupStatus;
    attempts?: number;
    completedAt?: string;
    lastError?: string;
    skipReason?: string;
  },
): Promise<QuotationFollowup | null> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) fields.status = updates.status;
  if (updates.attempts !== undefined) fields.attempts = updates.attempts;
  if (updates.completedAt) fields.completed_at = updates.completedAt;
  if (updates.lastError !== undefined) fields.last_error = updates.lastError;
  if (updates.skipReason !== undefined) fields.skip_reason = updates.skipReason;

  const { data, error } = await admin()
    .from("quotation_followups")
    .update(fields)
    .eq("id", followupId)
    .select()
    .maybeSingle();
  if (error) throw new APIError(error.message, 500);
  if (!data) return null;
  return toFollowup(data);
}

export async function customerHasRepliedSince(
  organizationId: string,
  customerId: string,
  since: string,
): Promise<boolean> {
  const { data, error } = await admin()
    .from("whatsapp_messages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("direction", "inbound")
    .gte("created_at", since)
    .limit(1);
  if (error) throw new APIError(error.message, 500);
  return (data ?? []).length > 0;
}

export async function getPendingMessagesForRetry(
  organizationId: string,
): Promise<WhatsAppMessage[]> {
  const { data, error } = await admin()
    .from("whatsapp_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "unknown"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new APIError(error.message, 500);
  return (data ?? []).map(toMessage);
}

export async function saveWebhookEvent(
  organizationId: string,
  providerEventId: string,
  eventType: string,
  payload: unknown,
): Promise<void> {
  const { error } = await admin()
    .from("webhook_events")
    .insert({
      organization_id: organizationId,
      provider_event_id: providerEventId,
      event_type: eventType,
      payload_json: payload,
    });
  if (error) throw new APIError(error.message, 500);
}
