import { NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin, failure, readJSON } from "@/lib/server/http";
import { APIError, sessionClient } from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = z
      .object({
        action: z.enum(["login", "logout", "verify"]),
        email: z.email().optional(),
        password: z.string().max(200).optional(),
        code: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
        factorId: z.string().optional(),
      })
      .parse(await readJSON(request));
    const client = await sessionClient();
    if (input.action === "logout") {
      await client.auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (input.action === "verify") {
      if (!input.code || !input.factorId)
        throw new APIError("Authenticator code required.");
      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: input.factorId,
        code: input.code,
      });
      if (error) throw new APIError("Invalid authenticator code.", 401);
      return NextResponse.json({ ok: true });
    }
    if (!input.email || !input.password)
      throw new APIError("Email and password required.");
    const { error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error)
      throw new APIError(
        "Sign-in failed. Check your credentials and try again.",
        401,
      );
    const { data } = await client.auth.mfa.listFactors();
    return NextResponse.json({
      ok: true,
      factorId: data?.totp.find((f) => f.status === "verified")?.id,
    });
  } catch (e) {
    return failure(e);
  }
}
