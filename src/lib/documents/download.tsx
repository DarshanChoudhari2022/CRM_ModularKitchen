import { pdf } from "@react-pdf/renderer";
import type { BusinessSettings, CRMRecord } from "@/domain/types";
import { FinancialDocument, registerDocumentFonts } from "./document";
import { numberPDF } from "./page-numbers";
export async function downloadDocument(
  record: CRMRecord,
  settings: BusinessSettings,
  demo: boolean,
  customer?: CRMRecord,
) {
  registerDocumentFonts("/fonts");
  const blob = await pdf(
    <FinancialDocument
      record={record}
      settings={settings}
      demo={demo}
      customer={customer}
    />,
  ).toBlob();
  const numbered = await numberPDF(new Uint8Array(await blob.arrayBuffer()));
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(numbered)], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(record.number ?? record.name).replaceAll("/", "-")}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
