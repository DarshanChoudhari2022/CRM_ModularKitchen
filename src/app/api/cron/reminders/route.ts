import { NextResponse } from "next/server";
import { admin, APIError } from "@/lib/server/supabase";
import { loadWorkspace } from "@/lib/server/repository";
import { failure } from "@/lib/server/http";
import { reminderEligible } from "@/domain/commands";
import { balanceFor } from "@/domain/pricing";
import { authorizedSecret } from "@/lib/integrations/verification";
import { buildAuthkeyPayload, sendAuthkey } from "@/lib/integrations/authkey";
import type { OutboxJob } from "@/domain/types";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (
      !authorizedSecret(
        request.headers.get("authorization"),
        process.env.CRON_SECRET,
      )
    )
      throw new APIError("Unauthorized scheduler.", 401);
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true")
      throw new APIError("External dispatch is disabled in demo mode.", 503);
    if (!process.env.AUTHKEY_API_KEY)
      throw new APIError("Authkey is not configured.", 503);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }).format(new Date()),
    );
    if (hour < 9 || hour > 18)
      return NextResponse.json({
        processed: 0,
        reason: "Outside India business contact hours.",
      });
    const db = admin();
    const { data: claimed, error } = await db.rpc("claim_reminders", {
      p_limit: 3,
    });
    if (error) throw new APIError("Could not claim pending reminders.", 503);
    let processed = 0;
    for (const row of claimed ?? []) {
      const job: OutboxJob = { ...row.data, status: "Sending" };
      const finish = async (patch: Partial<OutboxJob>) => {
        Object.assign(job, patch);
        const result = await db
          .from("outbox_jobs")
          .update({
            status: job.status,
            data: job,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("organization_id", row.organization_id);
        if (result.error)
          throw new APIError(
            "Dispatch outcome could not be persisted; reconcile provider before retry.",
            503,
          );
      };
      try {
        let workspace = await loadWorkspace(row.organization_id);
        let invoice = workspace.records.find((r) => r.id === job.invoiceId);
        let customer = workspace.records.find((r) => r.id === job.customerId);
        if (
          !invoice ||
          !customer ||
          !workspace.settings.reminderEnabled ||
          !reminderEligible(invoice, workspace.records)
        ) {
          await finish({
            status: "Suppressed",
            message:
              "Current balance, consent or collection policy blocks this reminder.",
          });
          continue;
        }
        const { data: reserved, error: reservationError } = await db.rpc(
          "reserve_contact",
          {
            p_organization: row.organization_id,
            p_customer: customer.id,
            p_gap_hours: workspace.settings.contactGapHours,
          },
        );
        if (reservationError || !reserved) {
          await finish({
            status: "Suppressed",
            message: "Customer contact frequency limit reached.",
          });
          continue;
        }
        // Re-read after contact reservation, as close to provider submission as practical.
        workspace = await loadWorkspace(row.organization_id);
        invoice = workspace.records.find((r) => r.id === job.invoiceId);
        customer = workspace.records.find((r) => r.id === job.customerId);
        if (
          !invoice ||
          !customer ||
          !workspace.settings.reminderEnabled ||
          !reminderEligible(invoice, workspace.records)
        ) {
          await finish({
            status: "Suppressed",
            message: "Eligibility changed before provider submission.",
          });
          continue;
        }
        const payload = buildAuthkeyPayload(
          customer.phone!,
          workspace.settings.authkeyTemplateId,
          {
            name: customer.name,
            number: invoice.number ?? invoice.id,
            balance: balanceFor(invoice, workspace.records),
            dueDate: invoice.dueDate ?? "Not specified",
          },
        );
        const result = await sendAuthkey(payload, process.env.AUTHKEY_API_KEY!);
        await finish(result);
        processed++;
      } catch {
        await finish({
          status: "Unknown",
          message:
            "Worker interrupted or outcome could not be established. Staff reconciliation required.",
        });
      }
    }
    return NextResponse.json({ processed });
  } catch (e) {
    return failure(e);
  }
}
