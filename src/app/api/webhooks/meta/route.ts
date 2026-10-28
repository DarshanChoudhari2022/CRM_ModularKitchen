import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/server/http";
import { APIError } from "@/lib/server/supabase";
import { saveEnquiry } from "@/lib/server/intake";
import { verifyHmac } from "@/lib/integrations/verification";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (
    token &&
    q.get("hub.mode") === "subscribe" &&
    q.get("hub.verify_token") === token
  )
    return new Response(q.get("hub.challenge"), {
      headers: { "Content-Type": "text/plain" },
    });
  return new Response("Verification failed", { status: 403 });
}
export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("Meta intake is disabled in demo mode.", 503);
    const raw = await request.text();
    if (raw.length > 250000) throw new APIError("Webhook too large.", 413);
    if (
      !verifyHmac(
        raw,
        request.headers.get("x-hub-signature-256"),
        process.env.META_APP_SECRET,
      )
    )
      throw new APIError("Invalid webhook signature.", 401);
    const body = z
      .object({
        entry: z
          .array(
            z.object({
              changes: z.array(
                z.object({
                  field: z.string(),
                  value: z
                    .object({
                      leadgen_id: z.string().optional(),
                      ad_id: z.string().optional(),
                      form_id: z.string().optional(),
                    })
                    .passthrough(),
                }),
              ),
            }),
          )
          .max(25),
      })
      .parse(JSON.parse(raw));
    const version = process.env.META_GRAPH_VERSION,
      token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!version || !/^v\d+\.\d+$/.test(version) || !token)
      throw new APIError("Meta retrieval is not configured.", 503);
    for (const entry of body.entry)
      for (const change of entry.changes) {
        if (change.field !== "leadgen" || !change.value.leadgen_id) continue;
        if (!/^\d+$/.test(change.value.leadgen_id))
          throw new APIError("Invalid provider lead ID.");
        const response = await fetch(
          `https://graph.facebook.com/${version}/${change.value.leadgen_id}?fields=id,field_data,ad_id,form_id`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!response.ok)
          throw new APIError(
            "Meta lead retrieval failed; provider should retry.",
            503,
          );
        const lead = z
          .object({
            id: z.string(),
            field_data: z.array(
              z.object({ name: z.string(), values: z.array(z.string()) }),
            ),
          })
          .parse(await response.json());
        const field = (name: string) =>
          lead.field_data.find((f) => f.name === name)?.values[0];
        await saveEnquiry({
          eventId: lead.id,
          name: field("full_name") ?? "Meta enquiry",
          phone: field("phone_number"),
          email: field("email"),
          locality: field("city"),
          source: "Meta Ads",
          campaign: change.value.ad_id,
          notes: `Meta form ${change.value.form_id ?? ""}. Review the original form answers and contact permission.`,
          consent: false,
        });
      }
    return NextResponse.json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
