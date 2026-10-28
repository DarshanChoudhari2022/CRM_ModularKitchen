import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { APIError } from "./supabase";
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new APIError("Request origin is not allowed.", 403);
}
export async function readJSON(request: Request) {
  const text = await request.text();
  if (text.length > 1_000_000) throw new APIError("Request too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new APIError("Invalid JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 5)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof APIError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  // Domain validation errors contain no provider credentials or SQL diagnostics.
  if (error instanceof Error && error.name === "Error")
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    {
      error:
        "The operation could not be completed. Please retry or contact your administrator.",
    },
    { status: 500 },
  );
}
