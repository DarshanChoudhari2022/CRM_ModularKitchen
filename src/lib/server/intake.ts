import "server-only";
import { z } from "zod";
import { admin, APIError } from "./supabase";
import { commitCommand, loadWorkspace } from "./repository";
import type { CRMRecord } from "@/domain/types";
export const enquirySchema = z
  .object({
    eventId: z.string().min(1).max(150),
    name: z.string().min(1).max(200),
    phone: z.string().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    locality: z.string().max(100).optional(),
    notes: z.string().max(5000).optional(),
    source: z.string().max(100),
    campaign: z.string().max(200).optional(),
    consent: z.boolean().default(false),
    consentNote: z.string().max(1000).optional(),
  })
  .strict();
export async function saveEnquiry(input: z.infer<typeof enquirySchema>) {
  const organizationId = process.env.INTEGRATION_ORGANIZATION_ID,
    userId = process.env.INTEGRATION_ACTOR_ID;
  if (!organizationId || !userId)
    throw new APIError(
      "Integration workspace and actor are not configured.",
      503,
    );
  const { data: member } = await admin()
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();
  if (!member || !["owner", "sales"].includes(member.role))
    throw new APIError("Integration actor requires sales membership.", 503);
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = await loadWorkspace(organizationId);
    const existing = s.records.find(
      (r) =>
        r.kind === "lead" &&
        r.source === input.source &&
        r.sourceEventId === input.eventId,
    );
    if (existing) return { id: existing.id, duplicate: true };
    const now = new Date().toISOString();
    const record: CRMRecord = {
      id: crypto.randomUUID(),
      kind: "lead",
      name: input.name,
      status: "New",
      phone: input.phone,
      email: input.email,
      locality: input.locality,
      notes: input.notes,
      source: input.source,
      sourceEventId: input.eventId,
      campaign: input.campaign,
      consent: input.consent,
      consentNote: input.consentNote,
      owner: userId,
      dueDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await commitCommand(
        organizationId,
        { userId, role: "sales" },
        { type: "save", record },
        s.revision,
      );
      return { id: record.id, duplicate: false };
    } catch (e) {
      if (!(e instanceof APIError) || e.status !== 409 || attempt === 2)
        throw e;
    }
  }
  throw new APIError("Enquiry was not persisted. Retry later.", 503);
}
