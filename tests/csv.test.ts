import { expect, it } from "vitest";
import { parseCSV, exportCSV } from "../src/domain/csv";
it("reads quoted commas, escaped quotes and line breaks", () => {
  expect(
    parseCSV('name,notes\r\n"Test, Client","A ""quoted"" note\nnext line"'),
  ).toEqual([{ name: "Test, Client", notes: 'A "quoted" note\nnext line' }]);
});
it("rejects missing headings and inconsistent rows instead of silently losing fields", () => {
  expect(() => parseCSV("name,name\na,b")).toThrow();
  expect(() => parseCSV("name,notes\na,b,c")).toThrow();
});
it("neutralizes spreadsheet formula injection in exports", () => {
  expect(
    exportCSV(
      [{ name: '=HYPERLINK("bad")', notes: "+123" }],
      ["name", "notes"],
    ),
  ).toContain("'=HYPERLINK");
});
