export function buildAuthkeyPayload(
  phone: string,
  templateId: string,
  values: { name: string; number: string; balance: string; dueDate: string },
) {
  const normalized = phone.replace(/[\s()-]/g, "");
  if (!/^\+91[6-9]\d{9}$/.test(normalized))
    throw new Error(
      "A valid Indian +91 mobile number is required for this adapter.",
    );
  if (!templateId)
    throw new Error("An approved Authkey template ID is required.");
  return {
    country_code: "91",
    mobile: normalized.slice(3),
    wid: templateId,
    type: "text",
    bodyValues: {
      var1: values.name,
      var2: values.number,
      var3: values.balance,
      var4: values.dueDate,
    },
  };
}
export function classifyAuthkeyResponse(
  ok: boolean,
  data: unknown,
): { status: "Sent" | "Unknown"; message: string; providerId?: string } {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  if (
    ok &&
    !record.error &&
    !record.Error &&
    typeof record.LogID === "string" &&
    record.LogID.length > 0
  )
    return {
      status: "Sent",
      providerId: record.LogID,
      message: "Provider submission acknowledged. Delivery remains unverified.",
    };
  return {
    status: "Unknown",
    message:
      "Provider outcome is unconfirmed. Reconcile in Authkey before retrying.",
  };
}
export async function sendAuthkey(
  payload: ReturnType<typeof buildAuthkeyPayload>,
  key: string,
) {
  try {
    const response = await fetch(
      "https://console.authkey.io/restapi/requestjson.php",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      },
    );
    const data = await response.json().catch(() => null);
    return classifyAuthkeyResponse(response.ok, data);
  } catch {
    return {
      status: "Unknown" as const,
      message:
        "Network or timeout after provider submission. Do not retry without reconciliation.",
    };
  }
}
