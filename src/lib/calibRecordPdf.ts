import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type CalibRecordPdfLine = {
  dcNo?: number | null;
  serialNo?: number | null;
  dueDate?: string | Date | null;
  calibratedDate?: string | Date | null;
  nextCalibDate?: string | Date | null;
  status?: string | null;
  resultStatus?: string | null;
  remarks?: string | null;
};

export type CalibRecordPdfData = {
  toolOrGaugeNo: string;
  name?: string | null;
  grouping?: string | null;
  type?: string | null;
  status?: string | null;
  frequency?: string | null;
  lastCalibrated?: string | Date | null;
  nextCalibrationDate?: string | Date | null;
  remarks?: string | null;
  companyName?: string | null;
  history?: CalibRecordPdfLine[];
};

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return s.includes("T") ? s.split("T")[0] : s.slice(0, 10);
}

function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

/** Single-tool calibration record PDF for reports / due-list row download. */
export function buildCalibRecordPdfBuffer(data: CalibRecordPdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 40;

  const company = (data.companyName || "Tools Management").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(company, pageW / 2, y, { align: "center" });
  y += 18;

  doc.setFontSize(15);
  doc.text("CALIBRATION RECORD", pageW / 2, y, { align: "center" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(data.toolOrGaugeNo, pageW / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 18;

  doc.setDrawColor(180);
  doc.line(marginX, y, pageW - marginX, y);
  y += 18;

  const fields: [string, string][] = [
    ["Tool / Gauge No", cell(data.toolOrGaugeNo)],
    ["Name", cell(data.name)],
    ["Group", cell(data.grouping)],
    ["Type", cell(data.type)],
    ["Frequency", cell(data.frequency)],
    ["Status", cell(data.status)],
    ["Last Calibrated", fmtDate(data.lastCalibrated)],
    ["Next Due", fmtDate(data.nextCalibrationDate)],
    ["Remarks", cell(data.remarks)],
  ];

  doc.setFontSize(10);
  for (const [label, value] of fields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, pageW - marginX * 2 - 120);
    doc.text(lines, marginX + 120, y);
    y += Math.max(16, lines.length * 12 + 4);
  }

  const history = data.history ?? [];
  if (history.length > 0) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Recent calibration transactions", marginX, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [["DC", "Serial", "Calibrated", "Next Due", "Result", "Status"]],
      body: history.map((h) => [
        h.dcNo != null ? String(h.dcNo) : "—",
        h.serialNo != null ? String(h.serialNo) : "—",
        fmtDate(h.calibratedDate ?? h.dueDate),
        fmtDate(h.nextCalibDate),
        cell(h.resultStatus),
        cell(h.status),
      ]),
      styles: { fontSize: 8, cellPadding: 3, overflow: "ellipsize" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", overflow: "ellipsize" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: marginX, right: marginX },
    });
  }

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Calibration Record`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 24,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}
