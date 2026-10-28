import { expect, it } from "vitest";
import {
  verifyHmac,
  authorizedSecret,
} from "../src/lib/integrations/verification";
import {
  buildAuthkeyPayload,
  classifyAuthkeyResponse,
} from "../src/lib/integrations/authkey";
import { createHmac } from "node:crypto";
it("verifies the raw webhook body and rejects absent or altered signatures", () => {
  const body = '{"entry":[]}';
  const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
  expect(verifyHmac(body, signature, "secret")).toBe(true);
  expect(verifyHmac(body + " ", signature, "secret")).toBe(false);
  expect(verifyHmac(body, "", "secret")).toBe(false);
  expect(authorizedSecret("Bearer abc", "abc")).toBe(true);
  expect(authorizedSecret("Bearer abc", "")).toBe(false);
});
it("keeps Authkey secrets out of URLs and sends the current balance as positional data", () => {
  expect(
    buildAuthkeyPayload("+919876543210", "100", {
      name: "Customer",
      number: "HT/1",
      balance: "123.45",
      dueDate: "2026-11-01",
    }),
  ).toEqual({
    country_code: "91",
    mobile: "9876543210",
    wid: "100",
    type: "text",
    bodyValues: {
      var1: "Customer",
      var2: "HT/1",
      var3: "123.45",
      var4: "2026-11-01",
    },
  });
  expect(() =>
    buildAuthkeyPayload("123", "100", {
      name: "X",
      number: "I",
      balance: "0",
      dueDate: "",
    }),
  ).toThrow();
});
it("does not confuse HTTP success or an unrecognised response with delivery confirmation", () => {
  expect(classifyAuthkeyResponse(true, { foo: "bar" }).status).toBe("Unknown");
  expect(classifyAuthkeyResponse(true, { LogID: "abc123" }).status).toBe(
    "Sent",
  );
  expect(classifyAuthkeyResponse(false, { error: "bad request" }).status).toBe(
    "Unknown",
  );
});
