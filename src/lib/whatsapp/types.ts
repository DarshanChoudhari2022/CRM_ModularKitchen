export type WhatsAppOptInStatus = 'opted_in' | 'opted_out' | 'pending' | 'unknown';
export type WhatsAppMessageDirection = 'outbound' | 'inbound';
export type WhatsAppMessageType = 'document' | 'template' | 'text' | 'media';
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
export type FollowupStatus = 'scheduled' | 'sent' | 'skipped' | 'cancelled' | 'failed';

export interface WhatsAppContact {
  id: string;
  organizationId: string;
  customerId: string;
  phoneNumber: string;
  optInStatus: WhatsAppOptInStatus;
  optInSource?: string;
  optedInAt?: string;
  optedOutAt?: string;
  lastInboundMessageAt?: string;
  serviceWindowExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  organizationId: string;
  quotationId: string;
  customerId: string;
  phoneNumber: string;
  providerMessageId?: string;
  direction: WhatsAppMessageDirection;
  messageType: WhatsAppMessageType;
  templateName?: string;
  status: WhatsAppMessageStatus;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  mediaObjectKey?: string;
  pdfObjectKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationFollowup {
  id: string;
  organizationId: string;
  quotationId: string;
  customerId: string;
  scheduledAt: string;
  status: FollowupStatus;
  attempts: number;
  completedAt?: string;
  lastError?: string;
  skipReason?: string;
  bullJobId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendQuotationInput {
  quotationId: string;
  customerId: string;
  phoneNumber: string;
  pdfObjectKey: string;
  templateName?: string;
}

export interface FollowupDecision {
  shouldSend: boolean;
  reason?: string;
  messageType?: WhatsAppMessageType;
  templateName?: string;
}
