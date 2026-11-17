import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/whatsapp/config", () => ({
  whatsappConfig: {
    accessToken: "test-token",
    phoneNumberId: "phone-id",
    baseUrl: "https://graph.facebook.com/v22.0",
  },
  isWhatsAppConfigured: () => true,
}));

import { sendDocumentTemplateMessage } from "../src/lib/whatsapp/service";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.123" }] }),
    }),
  );
});

it("submits the PDF in the approved template document header", async () => {
  const result = await sendDocumentTemplateMessage(
    "919876543210",
    "quotation_document_v1",
    "en",
    "media-123",
    "quotation-QT-1.pdf",
    [
      { type: "text", text: "Customer" },
      { type: "text", text: "QT-1" },
      { type: "text", text: "₹1,200" },
    ],
  );
  expect(result.providerMessageId).toBe("wamid.123");
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe("https://graph.facebook.com/v22.0/phone-id/messages");
  expect(JSON.parse(String(options?.body))).toMatchObject({
    type: "template",
    template: {
      name: "quotation_document_v1",
      language: { code: "en" },
      components: [
        { type: "header", parameters: [{ type: "document", document: { id: "media-123", filename: "quotation-QT-1.pdf" } }] },
        { type: "body", parameters: [{ text: "Customer" }, { text: "QT-1" }, { text: "₹1,200" }] },
      ],
    },
  });
});
