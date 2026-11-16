import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/server/http";
import { APIError } from "@/lib/server/supabase";
import { verifyHmac } from "@/lib/integrations/verification";
import { processWhatsAppEvent } from "@/lib/whatsapp/repository";

const timestamp = z
  .string()
  .regex(/^\d{1,11}$/)
  .transform((value, ctx) => {
    const date = new Date(Number(value) * 1000);
    if (
      !Number.isFinite(date.getTime()) ||
      date.getTime() > Date.now() + 300000
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid event timestamp" });
      return z.NEVER;
    }
    return date.toISOString();
  });
const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        id: z.string(),
        changes: z
          .array(
            z.object({
              field: z.literal("messages"),
              value: z.object({
                messaging_product: z.literal("whatsapp"),
                metadata: z.object({ phone_number_id: z.string().min(1) }),
                statuses: z
                  .array(
                    z.object({
                      id: z.string().min(1),
                      status: z.enum(["sent", "delivered", "read", "failed"]),
                      timestamp,
                      errors: z
                        .array(
                          z.object({
                            code: z.union([z.string(), z.number()]).optional(),
                            title: z.string().optional(),
                          }),
                        )
                        .optional(),
                    }),
                  )
                  .max(100)
                  .optional(),
                messages: z
                  .array(
                    z.object({
                      from: z.string().regex(/^\d{7,15}$/),
                      id: z.string().min(1),
                      timestamp,
                      type: z.string().min(1),
                      text: z
                        .object({ body: z.string().max(10000) })
                        .optional(),
                    }),
                  )
                  .max(100)
                  .optional(),
              }),
            }),
          )
          .max(100),
      }),
    )
    .max(25),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token)
    return failure(new APIError("WhatsApp verify token not configured.", 503));
  if (
    params.get("hub.mode") !== "subscribe" ||
    params.get("hub.verify_token") !== token
  )
    return new Response("Verification failed", { status: 403 });
  const challenge = params.get("hub.challenge");
  if (!challenge) return new Response("Challenge required", { status: 400 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("WhatsApp webhooks are disabled in demo mode.", 503);
    const secret = process.env.WHATSAPP_APP_SECRET;
    const organizationId = process.env.INTEGRATION_ORGANIZATION_ID;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!secret || !organizationId || !phoneId)
      throw new APIError("WhatsApp webhook configuration is incomplete.", 503);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 500000)
      throw new APIError("Webhook too large.", 413);
    if (!verifyHmac(raw, request.headers.get("x-hub-signature-256"), secret))
      throw new APIError("Invalid webhook signature.", 401);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new APIError("Invalid JSON.");
    }
    const body = webhookSchema.parse(json);
    // Validate every tenant identity before processing any event in the batch.
    const values = body.entry.flatMap((entry) =>
      entry.changes.map((change) => change.value),
    );
    if (values.some((value) => value.metadata.phone_number_id !== phoneId))
      throw new APIError(
        "Webhook phone number does not match this workspace.",
        403,
      );
    try {
      for (const value of values) {
        for (const status of value.statuses ?? [])
          await processWhatsAppEvent(
            organizationId,
            status.id,
            `message_status_${status.status}`,
            {
              status: status.status,
              at: status.timestamp,
              errorCode: status.errors?.[0]?.code?.toString(),
              errorMessage: status.errors?.[0]?.title,
            },
          );
        for (const message of value.messages ?? [])
          await processWhatsAppEvent(
            organizationId,
            message.id,
            "message_inbound",
            {
              from: message.from,
              at: message.timestamp,
              messageType: ["text", "document"].includes(message.type)
                ? message.type
                : "media",
              text: message.text?.body,
            },
          );
      }
    } catch {
      throw new APIError("Webhook processing failed. Retry delivery.", 503);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return failure(error);
  }
}
