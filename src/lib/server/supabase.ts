import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { roles, type Actor } from "@/domain/types";

export class APIError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function admin() {
  if (!configured())
    throw new APIError(
      "Supabase is not configured. Add the server environment variables.",
      503,
    );
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function sessionClient() {
  if (!configured()) throw new APIError("Supabase is not configured.", 503);
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure:
                process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ??
                false,
            }),
          ),
      },
    },
  );
}
export async function context(): Promise<{
  actor: Actor;
  organizationId: string;
  organizationName: string;
}> {
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new APIError("Sign in to continue.", 401);
  const { data, error: membershipError } = await admin()
    .from("memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !data || !roles.includes(data.role))
    throw new APIError(
      "No staff membership. Ask the owner to provision your account.",
      403,
    );
  const { data: org } = await admin()
    .from("organizations")
    .select("name")
    .eq("id", data.organization_id)
    .single();
  const { data: assurance } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  // Once a factor is enrolled, privileged users must complete it for every session.
  if (
    ["owner", "accounts"].includes(data.role) &&
    assurance?.nextLevel === "aal2" &&
    assurance.currentLevel !== "aal2"
  )
    throw new APIError(
      "Complete your authenticator verification to continue.",
      403,
    );
  return {
    actor: { userId: user.id, role: data.role },
    organizationId: data.organization_id,
    organizationName: org?.name ?? "Hutashana",
  };
}
