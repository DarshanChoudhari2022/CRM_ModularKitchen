import { whatsappConfig, isWhatsAppConfigured } from './config';
import type { WhatsAppMessageStatus } from './types';

class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public providerCode?: string,
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

function buildHeaders() {
  if (!isWhatsAppConfigured()) {
    throw new WhatsAppApiError('WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.', 503);
  }
  return {
    Authorization: `Bearer ${whatsappConfig.accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function uploadMedia(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer as unknown as BlobPart], { type: mimeType });
  formData.append('file', blob, filename);
  formData.append('type', mimeType);
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(`${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whatsappConfig.accessToken}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WhatsAppApiError(
      data.error?.message ?? `Media upload failed with status ${response.status}`,
      response.status,
      data.error?.code,
    );
  }
  return data.id as string;
}

export async function sendDocumentMessage(
  to: string,
  mediaId: string,
  caption?: string,
  filename?: string,
): Promise<{ providerMessageId: string }> {
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: '', // We use media_id instead; Meta accepts either link or id depending on API version
      id: mediaId,
      caption,
      filename,
    },
  };

  const response = await fetch(`${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WhatsAppApiError(
      data.error?.message ?? `Send document failed with status ${response.status}`,
      response.status,
      data.error?.code,
    );
  }
  const messages = data.messages as Array<{ id: string }> | undefined;
  return { providerMessageId: messages?.[0]?.id ?? '' };
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  parameters: Array<{ type: 'text'; text: string }>,
): Promise<{ providerMessageId: string }> {
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters,
        },
      ],
    },
  };

  const response = await fetch(`${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WhatsAppApiError(
      data.error?.message ?? `Send template failed with status ${response.status}`,
      response.status,
      data.error?.code,
    );
  }
  const messages = data.messages as Array<{ id: string }> | undefined;
  return { providerMessageId: messages?.[0]?.id ?? '' };
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  const response = await fetch(`${whatsappConfig.baseUrl}/${whatsappConfig.phoneNumberId}/messages`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Non-fatal: marking as read is a best-effort UX signal
    return;
  }
}

export interface WhatsAppWebhookEntry {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
          document?: { id: string; filename: string; mime_type: string };
        }>;
        statuses?: Array<{
          id: string;
          status: WhatsAppMessageStatus;
          timestamp: string;
          recipient_id: string;
          conversation?: { id: string; origin: { type: string } };
          pricing?: { billing_category: string; code: string };
          errors?: Array<{ code: string; title: string; message: string; error_data?: unknown }>;
        }>;
        errors?: Array<{ code: string; message: string; error_data?: unknown }>;
      };
      field: string;
    }>;
  }>;
}

export function parseWebhook(payload: unknown): WhatsAppWebhookEntry | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (obj.object !== 'whatsapp_business_account') return null;
  return obj as unknown as WhatsAppWebhookEntry;
}

export { WhatsAppApiError };
