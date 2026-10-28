export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  const headings = rows.shift()?.map((s) => s.trim());
  if (
    !headings?.length ||
    headings.some((s) => !s) ||
    new Set(headings).size !== headings.length
  )
    throw new Error("CSV needs non-empty, unique column headings.");
  if (rows.length > 250) throw new Error("Import up to 250 records at a time.");
  return rows.map((r, i) => {
    if (r.length !== headings.length)
      throw new Error(
        `Row ${i + 2} has ${r.length} fields; expected ${headings.length}.`,
      );
    return Object.fromEntries(headings.map((h, n) => [h, r[n].trim()]));
  });
}
export function exportCSV(
  records: Record<string, unknown>[],
  columns: string[],
): string {
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(escape).join(","),
    ...records.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ].join("\r\n");
}
export function downloadText(
  text: string,
  name: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
