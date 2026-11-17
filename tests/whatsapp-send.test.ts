import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  load: vi.fn(),
  commit: vi.fn(),
  contact: vi.fn(),
  messages: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  followup: vi.fn(),
  upload: vi.fn(),
  document: vi.fn(),
  template: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  context: mocks.context,
  APIError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/server/repository", () => ({
  loadWorkspace: mocks.load,
  commitCommand: mocks.commit,
}));
vi.mock("@/lib/whatsapp/config", () => ({ isWhatsAppConfigured: () => true }));
vi.mock("@/lib/whatsapp/repository", () => ({
  getContact: mocks.contact,
  getMessagesForQuotation: mocks.messages,
  createMessage: mocks.create,
  updateMessageStatus: mocks.update,
  createFollowup: mocks.followup,
}));
vi.mock("@/lib/whatsapp/service", () => ({
  uploadMedia: mocks.upload,
  sendDocumentMessage: mocks.document,
  sendDocumentTemplateMessage: mocks.template,
}));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: mocks.render }));
vi.mock("@/lib/documents/document", () => ({
  FinancialDocument: (props: unknown) => ({ props }),
  registerDocumentFonts: vi.fn(),
}));
vi.mock("@/lib/documents/page-numbers", () => ({
  numberPDF: async (bytes: Buffer) => bytes,
}));
import { POST } from "../src/app/api/whatsapp/send/route";
const quote = {
  id: "q1",
  kind: "quote",
  customerId: "c1",
  status: "Draft",
  name: "Kitchen",
  amount: "1200",
};
const customer = {
  id: "c1",
  kind: "customer",
  name: "Client",
  phone: "+919876543210",
  consent: true,
};
const workspace = () => ({
  revision: 12,
  settings: {},
  records: [{ ...quote }, { ...customer }],
});
const request = (extra = {}, origin = "http://localhost") =>
  new Request("http://localhost/api/whatsapp/send", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      quotationId: "q1",
      customerId: "c1",
      phoneNumber: customer.phone,
      ...extra,
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_NAME", "quotation_document_v1");
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_LANGUAGE", "en");
  mocks.context.mockResolvedValue({
    organizationId: "org",
    actor: { userId: "owner", role: "owner" },
  });
  mocks.load.mockResolvedValue(workspace());
  mocks.commit.mockResolvedValue({
    ...workspace(),
    revision: 13,
    records: [{ ...quote, status: "Shared", number: "QT-1" }, customer],
  });
  mocks.contact.mockResolvedValue({
    phoneNumber: customer.phone,
    optInStatus: "opted_in",
    serviceWindowExpiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  mocks.messages.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: "m1" });
  mocks.update.mockResolvedValue({ id: "m1" });
  mocks.render.mockResolvedValue(Buffer.from("pdf"));
  mocks.upload.mockResolvedValue("media1");
  mocks.document.mockResolvedValue({ providerMessageId: "provider1" });
  mocks.template.mockResolvedValue({ providerMessageId: "provider1" });
});
it("uses authenticated workspace revision, freezes before submission, and generates the PDF", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.commit).toHaveBeenCalledWith(
    "org",
    { userId: "owner", role: "owner" },
    { type: "transition", id: "q1", status: "Shared" },
    12,
  );
  expect(mocks.render.mock.calls[0][0].props.record.number).toBe("QT-1");
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.document.mock.invocationCallOrder[0],
  );
  expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.document.mock.invocationCallOrder[0],
  );
});
it("does not send when freezing conflicts", async () => {
  mocks.commit.mockRejectedValue(new Error("Conflict"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.document).not.toHaveBeenCalled();
});
it("rejects unauthorized roles and cross-origin requests", async () => {
  expect((await POST(request({}, "https://other.test"))).status).toBe(403);
  mocks.context.mockResolvedValue({
    organizationId: "org",
    actor: { userId: "sales", role: "sales" },
  });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("rejects terminal quotes and a different destination", async () => {
  expect((await POST(request({ phoneNumber: "+919999999999" }))).status).toBe(
    400,
  );
  mocks.load.mockResolvedValue({
    ...workspace(),
    records: [{ ...quote, status: "Accepted" }, customer],
  });
  expect((await POST(request())).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("requires consent and honors opt-out", async () => {
  mocks.load.mockResolvedValue({
    ...workspace(),
    records: [quote, { ...customer, consent: false }],
  });
  expect((await POST(request())).status).toBe(403);
  mocks.load.mockResolvedValue(workspace());
  mocks.contact.mockResolvedValue({ optInStatus: "opted_out" });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.template).not.toHaveBeenCalled();
});
it("sends the quotation PDF using the configured document template outside the service window", async () => {
  mocks.contact.mockResolvedValue({
    phoneNumber: customer.phone,
    serviceWindowExpiresAt: "2020-01-01",
  });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.template.mock.calls[0].slice(0, 5)).toEqual([
    "919876543210", "quotation_document_v1", "en", "media1", "quotation-QT-1.pdf",
  ]);
  expect(mocks.template.mock.calls[0][5]).toEqual([
    { type: "text", text: "Client" },
    { type: "text", text: "QT-1" },
    { type: "text", text: "1200" },
  ]);
  expect(mocks.render).toHaveBeenCalledOnce();
  expect(mocks.document).not.toHaveBeenCalled();
});
it("fails closed without a configured document template", async () => {
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_NAME", "");
  mocks.contact.mockResolvedValue({ phoneNumber: customer.phone, serviceWindowExpiresAt: "2020-01-01" });
  expect((await POST(request())).status).toBe(503);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("rejects client-selected template names", async () => {
  expect((await POST(request({ templateName: "unapproved" }))).status).toBe(400);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("blocks replay of unresolved or sent outbound messages", async () => {
  mocks.messages.mockResolvedValue([
    { direction: "outbound", status: "unknown" },
  ]);
  expect((await POST(request())).status).toBe(409);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("does not call the provider if pending intent cannot be saved", async () => {
  mocks.create.mockRejectedValue(new Error("Reservation rejected"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.document).not.toHaveBeenCalled();
});
it("records uncertain outcomes without scheduling follow-up", async () => {
  mocks.document.mockRejectedValue(new Error("Timeout"));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({
    status: "unknown",
    messageId: "m1",
  });
  expect(mocks.update).toHaveBeenCalledWith("m1", { status: "unknown" });
  expect(mocks.followup).not.toHaveBeenCalled();
});
it("treats absent provider acknowledgement as unknown", async () => {
  mocks.document.mockResolvedValue({ providerMessageId: "" });
  expect((await POST(request())).status).toBe(502);
  expect(mocks.update).toHaveBeenCalledWith("m1", { status: "unknown" });
});
