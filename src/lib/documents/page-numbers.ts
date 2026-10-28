import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
// Finalize after pagination so page labels are deterministic in browser and Node.
export async function numberPDF(bytes: Uint8Array): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes),
    font = await document.embedFont(StandardFonts.Helvetica),
    pages = document.getPages();
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, {
      x: page.getWidth() - 38 - font.widthOfTextAtSize(label, 7),
      y: 29,
      size: 7,
      font,
      color: rgb(0.56, 0.62, 0.5),
    });
  });
  return document.save();
}
