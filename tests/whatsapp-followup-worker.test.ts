import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  load: vi.fn(), claim: vi.fn(), finish: vi.fn(), contact: vi.fn(),
  messages: vi.fn(), replied: vi.fn(), create: vi.fn(), update: vi.fn(), send: vi.fn(),
}));
vi.mock("@/lib/server/repository", () => ({ loadWorkspace: mocks.load }));
vi.mock("@/lib/whatsapp/config", () => ({ isWhatsAppConfigured: () => true }));
vi.mock("@/lib/whatsapp/repository", () => ({
  claimDueFollowups: mocks.claim,
  finishClaimedFollowup: mocks.finish,
  getContact: mocks.contact,
  getMessagesForQuotation: mocks.messages,
  customerHasRepliedSince: mocks.replied,
  createMessage: mocks.create,
  updateMessageStatus: mocks.update,
}));
vi.mock("@/lib/whatsapp/service", () => ({ sendTemplateMessage: mocks.send }));
vi.mock("@/domain/pricing", () => ({ documentTotal: () => "₹1,200" }));
import { GET } from "../src/app/api/cron/quotation-followups/route";

const followup = {
  id: "f1", organizationId: "org", quotationId: "q1", customerId: "c1",
  claimToken: "claim-1", status: "sending", scheduledAt: "2026-11-16T04:30:00Z",
};
const workspace = () => ({ records: [
  { id: "q1", kind: "quote", customerId: "c1", status: "Shared", number: "QT-1" },
  { id: "c1", kind: "customer", name: "Client", phone: "+919876543210", consent: true },
] });
const request = (secret = "secret") => new Request("http://localhost/api/cron/quotation-followups", {
  headers: { authorization: `Bearer ${secret}` },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T05:30:00Z")); // 11:00 India time
  vi.stubEnv("CRON_SECRET", "secret");
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("INTEGRATION_ORGANIZATION_ID", "org");
  vi.stubEnv("WHATSAPP_FOLLOWUP_TEMPLATE_NAME", "quote_followup_v1");
  vi.stubEnv("WHATSAPP_QUOTE_TEMPLATE_LANGUAGE", "en");
  mocks.claim.mockResolvedValue([followup]);
  mocks.load.mockResolvedValue(workspace());
  mocks.contact.mockResolvedValue({ phoneNumber: "+919876543210", optInStatus: "opted_in" });
  mocks.messages.mockResolvedValue([{ id: "initial", direction: "outbound", status: "sent",
    sentAt: "2026-11-16T05:00:00Z", phoneNumber: "919876543210" }]);
  mocks.replied.mockResolvedValue(false);
  mocks.create.mockResolvedValue({ id: "m2" });
  mocks.update.mockResolvedValue({ id: "m2" });
  mocks.finish.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue({ providerMessageId: "wamid.2" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("rejects missing scheduler secret before claiming work", async () => {
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(mocks.claim).not.toHaveBeenCalled();
});

it("skips customer reply without provider submission", async () => {
  mocks.replied.mockResolvedValue(true);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ processed: 1, skipped: 1 });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.finish).toHaveBeenCalledWith(followup, "skipped", expect.any(Object));
});

it("records distinct message intent before sending approved follow-up template", async () => {
  const response = await GET(request());
  expect(await response.json()).toMatchObject({ processed: 1, sent: 1 });
  expect(mocks.create).toHaveBeenCalledWith("org", expect.objectContaining({ followupId: "f1" }));
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  expect(mocks.send).toHaveBeenCalledWith("919876543210", "quote_followup_v1", "en", [
    { type: "text", text: "Client" }, { type: "text", text: "QT-1" },
    { type: "text", text: "₹1,200" },
  ]);
  expect(mocks.finish).toHaveBeenCalledWith(followup, "sent", { providerMessageId: "wamid.2" });
});

it("marks timeout unknown and does not requeue it", async () => {
  mocks.send.mockRejectedValue(new Error("timeout"));
  expect(await (await GET(request())).json()).toMatchObject({ processed: 1, unknown: 1 });
  expect(mocks.update).toHaveBeenCalledWith("m2", { status: "unknown" });
  expect(mocks.finish).toHaveBeenCalledWith(followup, "unknown", expect.any(Object));
});

it("does not claim outside India contact hours", async () => {
  vi.setSystemTime(new Date("2026-11-17T16:00:00Z"));
  expect(await (await GET(request())).json()).toMatchObject({ processed: 0 });
  expect(mocks.claim).not.toHaveBeenCalled();
});
