import { NextResponse } from "next/server";
import { z } from "zod";
import { context } from "@/lib/server/supabase";
import { commitCommand, loadWorkspace } from "@/lib/server/repository";
import { redactWorkspace } from "@/domain/commands";
import { commandSchema } from "@/domain/types";
import { assertOrigin, failure, readJSON } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const ctx = await context();
    const workspace = redactWorkspace(
      await loadWorkspace(ctx.organizationId),
      ctx.actor,
    );
    return NextResponse.json(
      { workspace, ...ctx },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const ctx = await context();
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        command: commandSchema,
      })
      .strict()
      .parse(await readJSON(request));
    if (
      input.command.type === "attachEvidence" &&
      !input.command.file.path.startsWith(
        `${ctx.organizationId}/${input.command.id}/`,
      )
    )
      throw new Error("Evidence file path is not in this record workspace.");
    const workspace = await commitCommand(
      ctx.organizationId,
      ctx.actor,
      input.command,
      input.revision,
    );
    return NextResponse.json({
      workspace: redactWorkspace(workspace, ctx.actor),
    });
  } catch (e) {
    return failure(e);
  }
}
