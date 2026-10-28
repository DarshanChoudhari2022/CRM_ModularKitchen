import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  FinancialDocument,
  registerDocumentFonts,
} from "../src/lib/documents/document";
import { numberPDF } from "../src/lib/documents/page-numbers";
import { emptyWorkspace, blankLine } from "../src/domain/seed";
import { calculateQuote } from "../src/domain/pricing";
import type { CRMRecord } from "../src/domain/types";
it("renders a multi-page Unicode quotation with valid A4 pages and consistent frozen totals", async () => {
  registerDocumentFonts(path.join(process.cwd(), "public", "fonts"));
  const s = emptyWorkspace();
  s.settings.billingName = "Hutāśana Test Studio";
  const lines = Array.from({ length: 50 }, (_, i) => ({
    ...blankLine(),
    description: `${i + 1}. Cabinet specification with long finish, material, hardware and dimensional details for site review`,
    quantity: "2",
    rate: "1250",
    taxRate: "18",
  }));
  const record: CRMRecord = {
    id: "pdf-test",
    kind: "quote",
    name: "पुणे मॉड्युलर किचन · Quote review",
    status: "Shared",
    number: "QT-TEST-R1",
    revision: 1,
    createdAt: "2026-10-28T10:00:00Z",
    updatedAt: "2026-10-28T10:00:00Z",
    dueDate: "2026-11-15",
    lines,
    calculation: calculateQuote(lines),
    snapshot: {
      billingName: "Hutāśana Test Studio",
      billingAddress: "Pune, Maharashtra",
      gstin: "",
      phone: "",
      customerName: "अनन्या देशमुख",
      customerAddress: "Baner, Pune",
      customerGstin: "",
    },
    terms: "Customer confirms site measurements and exclusions.\n".repeat(25),
  };
  const bytes = await numberPDF(
    await renderToBuffer(
      FinancialDocument({ record, settings: s.settings, demo: true }),
    ),
  );
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
  expect(pdf.getPageCount()).toBeLessThan(10);
  expect(
    pdf.getPages().every((page) => Math.round(page.getWidth()) === 595),
  ).toBe(true);
  expect(record.calculation?.total).toBe("147500.00");
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/long-quotation.pdf", bytes);
}, 30000);
