/** Client-side Excel download helper (uses `xlsx`). */
import * as XLSX from "xlsx";

export type ExcelColumn<T> = {
  key: keyof T | string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
};

function cellValue<T extends object>(row: T, col: ExcelColumn<T>): string | number {
  const raw = col.value
    ? col.value(row)
    : (row as Record<string, unknown>)[col.key as string];
  if (raw == null || raw === "") return "";
  if (typeof raw === "string" || typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw);
}

export function downloadExcel<T extends object>(opts: {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}) {
  const headers = opts.columns.map((c) => c.label);
  const data = opts.rows.map((row) => opts.columns.map((c) => cellValue(row, c)));
  const aoa = [headers, ...data];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, (opts.sheetName || "Sheet1").slice(0, 31));
  const stamp = new Date().toISOString().slice(0, 10);
  const base = opts.filename.replace(/\.xlsx$/i, "");
  XLSX.writeFile(book, `${base}_${stamp}.xlsx`);
}
