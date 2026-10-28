import { createHmac, timingSafeEqual } from "node:crypto";
export function authorizedSecret(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false;
  const actual = Buffer.from(header),
    expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function verifyHmac(
  raw: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const actual = Buffer.from(signature.slice(7), "hex"),
    expected = createHmac("sha256", secret).update(raw).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
