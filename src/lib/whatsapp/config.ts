export const whatsappConfig = {
  // Meta WhatsApp Cloud API
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.WHATSAPP_API_VERSION ?? 'v22.0',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  baseUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v22.0'}`,
} as const;

export function isWhatsAppConfigured() {
  return !!(
    whatsappConfig.accessToken &&
    whatsappConfig.phoneNumberId
  );
}
