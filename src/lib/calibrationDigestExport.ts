import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { DueCalibrationTool } from "@/lib/calibrationDueEmail";

export type DigestExportMeta = {
  /** Recipient name, printed on the cover line. */
  recipientName: string;
  /** Recipient role, printed on the cover line. */
  roleName: string;
  /** Optional company name for the PDF header. */
  companyName?: string | null;
  /** Date the digest was generated for. */
  generatedAt: Date;
};

const unitLabel = (value: string | null) => value?.replace(/^UNIT/, "Unit ") ?? "Not assigned";

function fmtDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(item: DueCalibrationTool): string {
  if (item.dueStatus === "OVERDUE") {
    const days = Math.abs(item.daysRemaining);
    return `${days} day${days !== 1 ? "s" : ""} overdue`;
  }
  if (item.dueStatus === "DUE_TODAY") return "Due today";
  return `${item.daysRemaining} day${item.daysRemaining !== 1 ? "s" : ""} remaining`;
}

const COLUMNS = [
  "Tool / Gauge No.",
  "Tool Name",
  "Size",
  "Unit",
  "Used Location",
  "Due Date",
  "Status",
] as const;

function toRow(item: DueCalibrationTool): string[] {
  return [
    item.toolOrGaugeNo,
    item.name || item.description || "—",
    item.size || "—",
    unitLabel(item.unitCode),
    item.usedLocation || "—",
    fmtDate(item.dueDate),
    statusLabel(item),
  ];
}

function counts(items: DueCalibrationTool[]) {
  return {
    overdue: items.filter((i) => i.dueStatus === "OVERDUE").length,
    dueToday: items.filter((i) => i.dueStatus === "DUE_TODAY").length,
    dueSoon: items.filter((i) => i.dueStatus === "DUE_SOON").length,
  };
}

/** Full calibration due list as a single PDF table. */
export function buildCalibrationDigestPdf(
  items: DueCalibrationTool[],
  meta: DigestExportMeta,
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 32;
  let y = 40;

  const company = (meta.companyName || "Tools Management").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(company, pageW / 2, y, { align: "center" });
  y += 18;

  doc.setFontSize(15);
  doc.text("CALIBRATION DUE LIST", pageW / 2, y, { align: "center" });
  y += 16;

  const { overdue, dueToday, dueSoon } = counts(items);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `${meta.recipientName} (${meta.roleName})  ·  ${items.length} record${items.length !== 1 ? "s" : ""}  ·  ` +
      `${overdue} overdue, ${dueToday} due today, ${dueSoon} due soon  ·  ` +
      `Generated ${meta.generatedAt.toLocaleString("en-IN")}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  doc.setTextColor(0);
  y += 16;

  autoTable(doc, {
    startY: y,
    head: [[...COLUMNS]],
    body: items.map(toRow),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [10, 42, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginX, right: marginX },
    columnStyles: {
      0: { cellWidth: 105 },
      2: { cellWidth: 60 },
      3: { cellWidth: 58 },
      5: { cellWidth: 72 },
      6: { cellWidth: 92 },
    },
    // Colour the status cell by urgency.
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 6) return;
      const item = items[data.row.index];
      if (!item) return;
      if (item.dueStatus === "OVERDUE") data.cell.styles.textColor = [198, 40, 40];
      else if (item.dueStatus === "DUE_TODAY") data.cell.styles.textColor = [106, 27, 154];
      else data.cell.styles.textColor = [150, 110, 10];
      data.cell.styles.fontStyle = "bold";
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `SUKI ERP Tools Management · Calibration Due List · Page ${doc.getNumberOfPages()}`,
        pageW / 2,
        pageH - 18,
        { align: "center" },
      );
      doc.setTextColor(0);
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/** Full calibration due list as an .xlsx workbook. */
export function buildCalibrationDigestXlsx(
  items: DueCalibrationTool[],
  meta: DigestExportMeta,
): Buffer {
  const { overdue, dueToday, dueSoon } = counts(items);

  const header: (string | number)[][] = [
    ["Calibration Due List"],
    [`Recipient`, `${meta.recipientName} (${meta.roleName})`],
    [`Generated`, meta.generatedAt.toLocaleString("en-IN")],
    [`Total`, items.length, `Overdue`, overdue, `Due today`, dueToday, `Due soon`, dueSoon],
    [],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([...header, [...COLUMNS], ...items.map(toRow)]);
  sheet["!cols"] = [
    { wch: 20 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 18 },
  ];
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({
    s: { r: header.length, c: 0 },
    e: { r: header.length + items.length, c: COLUMNS.length - 1 },
  }) };
  sheet["!freeze"] = { xSplit: "0", ySplit: String(header.length + 1) };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Calibration Due");

  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
