import { NextResponse } from "next/server";
import { APIError, context } from "@/lib/server/supabase";
import { failure } from "@/lib/server/http";
export async function GET() {
  try {
    const ctx = await context();
    if (ctx.actor.role !== "owner")
      throw new APIError("Owner access required.", 403);
    return NextResponse.json({
      authkey: !!process.env.AUTHKEY_API_KEY,
      meta: !!(
        process.env.META_APP_SECRET &&
        process.env.META_PAGE_ACCESS_TOKEN &&
        process.env.META_GRAPH_VERSION
      ),
      voice: !!(process.env.VOICE_WEBHOOK_SECRET && process.env.BOLNA_AGENT_ID),
    });
  } catch (e) {
    return failure(e);
  }
}
