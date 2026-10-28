import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, readJSON } from "@/lib/server/http";
import { APIError } from "@/lib/server/supabase";
import { saveEnquiry } from "@/lib/server/intake";
import { authorizedSecret } from "@/lib/integrations/verification";
// Vendor-neutral outcome contract; configure your provider's tool/relay to map its payload.
// It can create enquiries only: no payment, pricing or invoice mutation tools are exposed.
export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("Voice intake is disabled in demo mode.", 503);
    if (
      !authorizedSecret(
        request.headers.get("authorization"),
        process.env.VOICE_WEBHOOK_SECRET,
      )
    )
      throw new APIError("Unauthorized voice callback.", 401);
    const input = z
      .object({
        callId: z.string().min(1).max(150),
        customerName: z.string().min(1).max(200),
        phone: z.string().max(30).optional(),
        locality: z.string().max(100).optional(),
        summary: z.string().max(5000),
        language: z.enum(["Marathi", "Hindi", "English"]),
        requestedHuman: z.boolean(),
        callbackPermission: z.boolean(),
      })
      .strict()
      .parse(await readJSON(request));
    return NextResponse.json(
      await saveEnquiry({
        eventId: input.callId,
        name: input.customerName,
        phone: input.phone,
        locality: input.locality,
        source: "Voice agent",
        notes: `${input.language} · ${input.requestedHuman ? "HUMAN CALLBACK REQUESTED. " : ""}${input.summary}\nCallback permission: ${input.callbackPermission ? "Recorded by agent; staff must verify" : "Not recorded"}`,
        consent: false,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
