import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type CalibDcPdfLine = {
  toolOrGaugeNo: string | null;
  name?: string | null;
  grouping?: string | null;
  issueQty?: number | null;
  serialNo?: number | null;
  dueDate?: string | Date | null;
  calibDueDate?: string | Date | null;
  status?: string | null;
};

export type CalibDcPdfHeader = {
  dcNo: number;
  receiveName?: string | null;
  subCode?: string | null;
  issueDate?: string | Date | null;
  issueFor?: string | null;
  toolsPoNo?: string | null;
  status?: string | null;
  lines: CalibDcPdfLine[];
  companyName?: string | null;
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

/** Build Delivery Challan PDF for a calibration issue DC. */
export function buildCalibDcPdfBuffer(header: CalibDcPdfHeader): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 40;

  const company = (header.companyName || "Tools Management").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(company, pageW / 2, y, { align: "center" });
  y += 18;

  doc.setFontSize(16);
  doc.text("DELIVERY CHALLAN", pageW / 2, y, { align: "center" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Calibration / Preventive Issue", pageW / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 20;

  doc.setDrawColor(180);
  doc.line(marginX, y, pageW - marginX, y);
  y += 16;

  const leftCol: [string, string][] = [
    ["DC No", `#${header.dcNo}`],
    ["Issue Date", fmtDate(header.issueDate)],
    ["Issue For", cell(header.issueFor)],
    ["Status", cell(header.status)],
  ];
  const rightCol: [string, string][] = [
    ["Issued To", cell(header.receiveName)],
    ["Party / Sub Code", cell(header.subCode)],
    ["Tools PO No", cell(header.toolsPoNo)],
    ["Lines", String(header.lines.length)],
  ];

  doc.setFontSize(9);
  const rowH = 14;
  for (let i = 0; i < Math.max(leftCol.length, rightCol.length); i++) {
    const [lk, lv] = leftCol[i] ?? ["", ""];
    const [rk, rv] = rightCol[i] ?? ["", ""];
    if (lk) {
      doc.setFont("helvetica", "bold");
      doc.text(`${lk}:`, marginX, y);
      doc.setFont("helvetica", "normal");
      doc.text(lv, marginX + 78, y);
    }
    if (rk) {
      doc.setFont("helvetica", "bold");
      doc.text(`${rk}:`, pageW / 2 + 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(rv, pageW / 2 + 100, y);
    }
    y += rowH;
  }

  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["#", "Tool / Gauge No", "Name", "Group", "Qty", "Serial", "Calib Due", "Status"]],
    body: header.lines.map((line, idx) => [
      String(idx + 1),
      cell(line.toolOrGaugeNo),
      cell(line.name),
      cell(line.grouping),
      cell(line.issueQty ?? 1),
      line.serialNo != null ? String(line.serialNo) : "—",
      fmtDate(line.calibDueDate ?? line.dueDate),
      cell(line.status),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 40 },
    },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? y + 40;
  let sigY = finalY + 36;
  if (sigY > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    sigY = 60;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Prepared by", marginX, sigY);
  doc.text("Authorized by", pageW / 2, sigY);
  doc.text("Received by", pageW - marginX - 90, sigY);
  doc.setDrawColor(120);
  doc.line(marginX, sigY + 28, marginX + 110, sigY + 28);
  doc.line(pageW / 2, sigY + 28, pageW / 2 + 110, sigY + 28);
  doc.line(pageW - marginX - 110, sigY + 28, pageW - marginX, sigY + 28);

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Calibration Delivery Challan`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 24,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}
