import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportColumn = { key: string; label: string };

function formatCell(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.split("T")[0];
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "report";
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function buildExcelBuffer(options: {
  sheetName: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}): Buffer {
  const { sheetName, columns, rows } = options;
  const aoa = [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => formatCell(row[c.key]))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = columns.map((c) => ({
    wch: Math.min(40, Math.max(12, c.label.length + 4)),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31) || "Report");
  const out = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out);
}

export function buildPdfBuffer(options: {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}): Buffer {
  const { title, subtitle, columns, rows } = options;
  const doc = new jsPDF({
    orientation: columns.length > 6 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(13);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    [subtitle, `Records: ${rows.length.toLocaleString()}`, `Generated: ${new Date().toLocaleString()}`]
      .filter(Boolean)
      .join("  ·  "),
    40,
    52
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 64,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => formatCell(row[c.key]))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 28, right: 28 },
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function exportFilename(base: string, format: "xlsx" | "pdf") {
  return `${sanitizeFilename(base)}_${stamp()}.${format === "xlsx" ? "xlsx" : "pdf"}`;
}
