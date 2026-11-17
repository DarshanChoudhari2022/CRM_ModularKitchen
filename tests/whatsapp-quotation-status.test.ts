import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  load: vi.fn(),
  contact: vi.fn(),
  messages: vi.fn(),
  followups: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  context: mocks.context,
  APIError: class extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  },
}));
vi.mock("@/lib/server/repository", () => ({ loadWorkspace: mocks.load }));
vi.mock("@/lib/whatsapp/config", () => ({ isWhatsAppConfigured: () => true }));
vi.mock("@/lib/whatsapp/repository", () => ({
  getContact: mocks.contact,
  getMessagesForQuotation: mocks.messages,
  getFollowupsForQuotation: mocks.followups,
}));

import { GET } from "../src/app/api/whatsapp/quotation/[id]/route";

const request = new Request("http://localhost/api/whatsapp/quotation/q1");
const params = { params: Promise.resolve({ id: "q1" }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_NAME", "quotation_document_v1");
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_LANGUAGE", "en");
  mocks.context.mockResolvedValue({
    organizationId: "org1",
    actor: { userId: "u1", role: "sales" },
  });
  mocks.load.mockResolvedValue({ records: [
    { id: "q1", kind: "quote", customerId: "c1" },
    { id: "c1", kind: "customer" },
  ] });
  mocks.contact.mockResolvedValue({ customerId: "c1", optInStatus: "opted_in" });
  mocks.messages.mockResolvedValue([{ id: "m1", status: "delivered" }]);
  mocks.followups.mockResolvedValue([{ id: "f1", status: "scheduled" }]);
});

it("returns the authenticated organization's quotation status and configuration", async () => {
  const response = await GET(request, params);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    configured: true,
    templateName: "quotation_document_v1",
    templateLanguage: "en",
    messages: [{ id: "m1" }],
    followups: [{ id: "f1" }],
    contact: { customerId: "c1" },
  });
  expect(mocks.messages).toHaveBeenCalledWith("org1", "q1");
  expect(mocks.followups).toHaveBeenCalledWith("org1", "q1");
  expect(mocks.contact).toHaveBeenCalledWith("org1", "c1");
});

it("does not read WhatsApp rows for an absent quotation or unauthorized role", async () => {
  mocks.load.mockResolvedValue({ records: [] });
  expect((await GET(request, params)).status).toBe(404);
  expect(mocks.messages).not.toHaveBeenCalled();
  mocks.context.mockResolvedValue({
    organizationId: "org1",
    actor: { userId: "u2", role: "installer" },
  });
  expect((await GET(request, params)).status).toBe(404);
  expect(mocks.load).toHaveBeenCalledTimes(1);
});
