import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionClient, APIError } from "@/lib/server/supabase";
import { assertOrigin, failure, readJSON } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const client = await sessionClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new APIError("Sign in first.", 401);
    const input = z
      .object({
        action: z.enum(["enroll", "verify"]),
        factorId: z.string().optional(),
        code: z.string().optional(),
      })
      .parse(await readJSON(request));
    if (input.action === "enroll") {
      const { data: existing } = await client.auth.mfa.listFactors();
      if (existing?.totp.some((f) => f.status === "verified"))
        throw new APIError(
          "An authenticator is already enrolled. Contact the administrator for recovery.",
        );
      for (const factor of existing?.all ?? [])
        if (factor.factor_type === "totp" && factor.status === "unverified")
          await client.auth.mfa.unenroll({ factorId: factor.id });
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Hutashana Workspace",
        issuer: "Hutashana",
      });
      if (error)
        throw new APIError("Authenticator enrollment could not be started.");
      return NextResponse.json({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }
    if (!input.factorId || !/^\d{6}$/.test(input.code ?? ""))
      throw new APIError("Enter a six-digit authenticator code.");
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code!,
    });
    if (error) throw new APIError("Authenticator verification failed.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
