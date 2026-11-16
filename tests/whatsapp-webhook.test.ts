import { beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
const processEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/whatsapp/repository", () => ({
  processWhatsAppEvent: processEvent,
}));
import { POST } from "../src/app/api/whatsapp/webhook/route";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("WHATSAPP_APP_SECRET", "secret");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id");
  vi.stubEnv("INTEGRATION_ORGANIZATION_ID", "org");
  processEvent.mockReset();
});
const payload = (phone = "phone-id") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "account",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: phone },
            statuses: [
              { id: "msg", status: "delivered", timestamp: "1700000000" },
            ],
          },
        },
      ],
    },
  ],
});
function request(body: unknown, signed = true) {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    body: raw,
    headers: signed
      ? {
          "x-hub-signature-256": `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`,
        }
      : {},
  });
}
it("rejects missing signatures before any persistence", async () => {
  expect((await POST(request(payload(), false))).status).toBe(401);
  expect(processEvent).not.toHaveBeenCalled();
});
it("fails closed without app secret", async () => {
  vi.stubEnv("WHATSAPP_APP_SECRET", "");
  expect((await POST(request(payload()))).status).toBe(503);
});
it("rejects another phone number and malformed nested data", async () => {
  expect((await POST(request(payload("other")))).status).toBe(403);
  expect(
    (await POST(request({ object: "whatsapp_business_account", entry: [{}] })))
      .status,
  ).toBe(400);
  expect(processEvent).not.toHaveBeenCalled();
});
it("converts provider timestamps and preserves event identity", async () => {
  expect((await POST(request(payload()))).status).toBe(200);
  expect(processEvent).toHaveBeenCalledWith(
    "org",
    "msg",
    "message_status_delivered",
    expect.objectContaining({
      status: "delivered",
      at: "2023-11-14T22:13:20.000Z",
    }),
  );
});
it("returns retryable failure when transactional processing fails", async () => {
  processEvent.mockRejectedValue(new Error("database unavailable"));
  expect((await POST(request(payload()))).status).toBe(503);
});
