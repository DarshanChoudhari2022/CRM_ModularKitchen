import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { NextResponse } from "next/server";
import { APIError, context } from "@/lib/server/supabase";
import { loadWorkspace } from "@/lib/server/repository";
import { failure } from "@/lib/server/http";
import {
  FinancialDocument,
  registerDocumentFonts,
} from "@/lib/documents/document";
import { canRead } from "@/domain/commands";
import { numberPDF } from "@/lib/documents/page-numbers";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await context();
    const { id } = await params;
    const workspace = await loadWorkspace(ctx.organizationId);
    const record = workspace.records.find(
      (r) => r.id === id && ["quote", "invoice"].includes(r.kind),
    );
    if (!record || !canRead(ctx.actor.role, record.kind))
      throw new APIError("Document not found.", 404);
    registerDocumentFonts(path.join(process.cwd(), "public", "fonts"));
    const bytes = await renderToBuffer(
      <FinancialDocument
        record={record}
        settings={workspace.settings}
        customer={workspace.records.find((c) => c.id === record.customerId)}
      />,
    );
    return new NextResponse(new Uint8Array(await numberPDF(bytes)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(record.number ?? "draft").replace(/[^a-zA-Z0-9-]/g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
