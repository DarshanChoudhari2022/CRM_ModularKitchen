import { NextResponse } from "next/server";
import { admin, APIError, context } from "@/lib/server/supabase";
import { assertOrigin, failure } from "@/lib/server/http";
import { commitCommand, loadWorkspace } from "@/lib/server/repository";
import { canRead, canWrite, redactWorkspace } from "@/domain/commands";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const ctx = await context();
    if (Number(request.headers.get("content-length") ?? 0) > 11_000_000)
      throw new APIError("Evidence upload must be at most 10 MB.", 413);
    const form = await request.formData(),
      file = form.get("file"),
      id = form.get("recordId");
    if (
      !(file instanceof File) ||
      typeof id !== "string" ||
      file.size === 0 ||
      file.size > 10485760
    )
      throw new APIError("Choose a PDF, PNG, JPEG or WebP file up to 10 MB.");
    const workspace = await loadWorkspace(ctx.organizationId),
      record = workspace.records.find((r) => r.id === id);
    if (
      !record ||
      !canWrite(ctx.actor.role, record.kind) ||
      (ctx.actor.role === "installer" && record.owner !== ctx.actor.userId)
    )
      throw new APIError("You cannot attach evidence to this record.", 403);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const starts = (signature: number[]) =>
      signature.every((n, i) => bytes[i] === n);
    let mime: "application/pdf" | "image/png" | "image/jpeg" | "image/webp",
      extension: string;
    if (starts([37, 80, 68, 70, 45])) {
      mime = "application/pdf";
      extension = "pdf";
    } else if (starts([137, 80, 78, 71, 13, 10, 26, 10])) {
      mime = "image/png";
      extension = "png";
    } else if (starts([255, 216, 255])) {
      mime = "image/jpeg";
      extension = "jpg";
    } else if (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    ) {
      mime = "image/webp";
      extension = "webp";
    } else throw new APIError("File content is not a supported PDF or image.");
    const path = `${ctx.organizationId}/${id}/${crypto.randomUUID()}.${extension}`;
    const db = admin(),
      { error } = await db.storage
        .from("crm-private")
        .upload(path, bytes, { contentType: mime, upsert: false });
    if (error)
      throw new APIError(
        "Private upload failed. Check the storage migration and quota.",
        503,
      );
    try {
      const after = await commitCommand(
        ctx.organizationId,
        ctx.actor,
        {
          type: "attachEvidence",
          id,
          file: {
            name: file.name.slice(0, 200),
            path,
            mime,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          },
        },
        workspace.revision,
      );
      return NextResponse.json({
        workspace: redactWorkspace(after, ctx.actor),
      });
    } catch (e) {
      await db.storage.from("crm-private").remove([path]);
      throw e;
    }
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const ctx = await context(),
      url = new URL(request.url),
      id = url.searchParams.get("recordId"),
      path = url.searchParams.get("path");
    const workspace = await loadWorkspace(ctx.organizationId),
      record = workspace.records.find((r) => r.id === id);
    if (
      !record ||
      !canRead(ctx.actor.role, record.kind) ||
      (ctx.actor.role === "installer" && record.owner !== ctx.actor.userId)
    )
      throw new APIError("Evidence not found.", 404);
    const file = record.files?.find((f) => f.path === path);
    if (!file || !file.path.startsWith(`${ctx.organizationId}/${record.id}/`))
      throw new APIError("Evidence not found.", 404);
    const { data, error } = await admin()
      .storage.from("crm-private")
      .createSignedUrl(file.path, 60, { download: file.name });
    if (error)
      throw new APIError("Could not generate a private file link.", 503);
    return NextResponse.redirect(data.signedUrl, {
      headers: { "Cache-Control": "private,no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
