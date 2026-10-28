import "server-only";
import { admin, APIError } from "./supabase";
import { emptyWorkspace } from "@/domain/seed";
import type { Actor, Command, Workspace } from "@/domain/types";
import { execute } from "@/domain/commands";

export async function loadWorkspace(
  organizationId: string,
): Promise<Workspace> {
  const { data, error } = await admin().rpc("read_workspace", {
    p_organization: organizationId,
  });
  if (error || !data)
    throw new APIError(
      "Could not load workspace. Check that the CRM migration has been applied.",
      503,
    );
  if ((data.records?.length ?? 0) > 10000)
    throw new APIError(
      "Active workspace limit exceeded. Enable paginated storage before continuing.",
      503,
    );
  const empty = emptyWorkspace();
  return {
    revision: data.revision,
    settings: { ...empty.settings, ...data.settings },
    records: data.records,
    audit: data.audit,
    jobs: data.jobs,
  };
}
export async function commitCommand(
  organizationId: string,
  actor: Actor,
  command: Command,
  revision: number,
): Promise<Workspace> {
  const before = await loadWorkspace(organizationId);
  if (before.revision !== revision)
    throw new APIError(
      "Another user updated the workspace. Refresh and retry; your change was not applied.",
      409,
    );
  const after = execute(before, command, actor);
  const changed = after.records.filter(
    (r) =>
      JSON.stringify(r) !==
      JSON.stringify(before.records.find((old) => old.id === r.id)),
  );
  const changedJobs = after.jobs.filter(
    (j) =>
      JSON.stringify(j) !==
      JSON.stringify(before.jobs.find((old) => old.id === j.id)),
  );
  const { error } = await admin().rpc("commit_workspace", {
    p_organization: organizationId,
    p_actor: actor.userId,
    p_revision: revision,
    p_settings: after.settings,
    p_records: changed,
    p_jobs: changedJobs,
    p_audit: after.audit[0],
  });
  if (error?.code === "40001")
    throw new APIError(
      "Another user updated the workspace. Refresh and retry.",
      409,
    );
  if (error?.code === "23505")
    throw new APIError(
      "A duplicate invoice number, payment reference, SKU or source event was rejected.",
      409,
    );
  if (error)
    throw new APIError(
      "Database transaction was not committed. Contact the administrator.",
      503,
    );
  return after;
}
