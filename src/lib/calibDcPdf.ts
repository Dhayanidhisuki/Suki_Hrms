import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getManproLogoDataUrl } from "@/lib/pdfBranding";
import { drawPdfQr } from "@/lib/pdfQr";

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
  subAddress1?: string | null;
  subAddress2?: string | null;
  subGstin?: string | null;
  issueDate?: string | Date | null;
  issueFor?: string | null;
  toolsPoNo?: string | null;
  status?: string | null;
  preparedBy?: string | null;
  lines: CalibDcPdfLine[];
  companyName?: string | null;
  verificationUrl?: string | null;
};

const COMPANY_LINES = [
  "95.D/3 Ambattur Industrial Estate",
  "Chennai, 33, 600058",
  "Phone : 04426243875, GSTIN: 33AAFCM6958H1Z7",
  "Email: purchaseorder@manproequipments.com",
];

const TERMS = [
  "The subcontractor shall perform all work strictly as per the specifications, drawings, and instructions provided by Manpro.",
  "The subcontractor shall complete the work within the agreed schedule. Any delay must be communicated in writing in advance and is subject to approval.",
  "All materials supplied by Manpro must be handled with care. Any loss or damage due to negligence will be charged to the subcontractor.",
  "Product must be accompanied by both the COC and inspection report upon dispatch.",
  "No substitutions are allowed.",
  "Tools and equipment provided by Manpro must be returned in good condition. Any damage/loss will be recovered.",
  "Payments will be made as per mutually agreed terms, subject to approval of quality, quantity, and documentation.",
  "If any part of the work is found defective or non-compliant, the subcontractor shall rework it at their own cost without delay.",
  "The subcontractor shall not disclose technical or commercial information received during the course of work without prior written consent.",
  "The supply must include COC and inspection report adhering to our purchase order requirements.",
  "All COC and inspection reports must be sent before dispatch to documents@manproequipments.com and velu@manproequipments.com.",
  "For try-out / FA PO requirements, all related certificates must be sent to the Manpro QA engineer for approval before shipping.",
  "Deviations must be submitted in the Manpro Supplier Deviation Request format and approved before shipping.",
  "Any kind of repair work is not allowed unless specifically authorized.",
  "Supplier shall comply with FGS15B13.0 (Supplier Quality Procedure) where applicable.",
  "Hard-copy and soft-copy certificates must be clear, legible, and free from damage.",
  "The subcontractor must adhere to applicable safety norms, guidelines, and statutory requirements at the work site.",
  "IF ANY DOUBT, ASK!",
];

function cell(value: unknown): string {
  return value == null || value === "" ? "—" : String(value);
}

function dateText(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function dcLabel(dcNo: number, issueDate?: string | Date | null): string {
  const d = issueDate ? new Date(issueDate) : new Date();
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const month = Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  const fyStart = month >= 3 ? year : year - 1;
  return `DC/${fyStart}-${String(fyStart + 1).slice(-2)}/${dcNo}`;
}

function drawPageBase(doc: jsPDF, header: CalibDcPdfHeader, pageNo: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = 20;
  const width = pageW - 40;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(x, 20, width, 75);

  const logo = getManproLogoDataUrl();
  if (logo) doc.addImage(logo, "PNG", 28, 29, 158, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  COMPANY_LINES.forEach((line, index) => doc.text(line, 200, 44 + index * 10));

  doc.line(500, 20, 500, 95);
  drawPdfQr(doc, header.verificationUrl || `CALIBRATION-DC:${header.dcNo}`, 512, 32, 50);
  doc.setFontSize(5.5);
  doc.text("SCAN TO VERIFY", 537, 89, { align: "center" });

  doc.rect(x, 95, width, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SUB CONTRACT DELIVERY NOTE", pageW / 2, 109, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("MP-QA-07 / REV 04 / 23.08.2024", 20, pageH - 18);
  doc.text("Suki ERP V3.5", pageW / 2, pageH - 18, { align: "center" });
  doc.text(`Page ${pageNo} of 2`, pageW - 20, pageH - 18, { align: "right" });
}

function drawSignatures(doc: jsPDF, header: CalibDcPdfHeader, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared By.", 28, y);
  doc.text("Received By.", pageW / 2, y);
  doc.text("For Manpro Equipments Private Limited", pageW - 28, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(cell(header.preparedBy), 28, y + 28);
  doc.text("Signature", pageW / 2, y + 28);
  doc.text("Authorised Signatory", pageW - 28, y + 28, { align: "right" });
}

/** Manpro subcontract delivery-note format for calibration issue DCs. */
export function buildCalibDcPdfBuffer(header: CalibDcPdfHeader): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const x = 20;
  const width = pageW - 40;
  drawPageBase(doc, header, 1);

  doc.rect(x, 115, width, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`DC No   ${dcLabel(header.dcNo, header.issueDate)}`, 30, 129);
  doc.text(`DC.Date   ${dateText(header.issueDate)}`, pageW / 2 + 10, 129);

  doc.rect(x, 135, width, 78);
  doc.line(pageW / 2, 135, pageW / 2, 213);
  doc.setFontSize(8.5);
  doc.text(`To, ${cell(header.receiveName)}`, 28, 151);
  doc.text(`(${cell(header.subCode)})`, 28, 163);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(cell(header.subAddress1), 28, 176);
  doc.text(cell(header.subAddress2), 28, 188);
  doc.setFont("helvetica", "bold");
  doc.text(`GSTIN : ${cell(header.subGstin)}`, 28, 201);
  doc.setFontSize(8);
  doc.text("Vehicle No", pageW / 2 + 8, 151);
  doc.text("SubContractor Copy", pageW / 2 + 8, 165);
  doc.text("Acknowledgement Copy", pageW / 2 + 8, 179);
  doc.text("Gate Copy", pageW / 2 + 8, 193);
  doc.setFont("helvetica", "normal");
  doc.text(":   —", pageW / 2 + 105, 151);
  doc.text(":   SubContractor", pageW / 2 + 105, 165);
  doc.text(":   From SubContractor", pageW / 2 + 105, 179);
  doc.text(":   MANPRO Security", pageW / 2 + 105, 193);

  autoTable(doc, {
    startY: 213,
    head: [["SL.No", "RC No", "Part No", "Part Name", "Heat No", "Material Spec", "Comments", "Qty", "Value"]],
    body: header.lines.map((line, index) => [
      String(index + 1).padStart(2, "0"),
      header.toolsPoNo && header.toolsPoNo !== "Any" ? header.toolsPoNo : "—",
      cell(line.toolOrGaugeNo),
      cell(line.name),
      line.serialNo != null ? String(line.serialNo) : "—",
      cell(line.grouping),
      cell(line.status || header.issueFor),
      Number(line.issueQty ?? 1).toFixed(2),
      "0.00",
    ]),
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 2.5, lineColor: 0, lineWidth: 0.5, textColor: 0 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    margin: { left: x, right: x },
    columnStyles: {
      0: { cellWidth: 28 }, 1: { cellWidth: 65 }, 2: { cellWidth: 80 },
      3: { cellWidth: 86 }, 4: { cellWidth: 45 }, 5: { cellWidth: 88 },
      6: { cellWidth: 64 }, 7: { cellWidth: 34, halign: "right" }, 8: { cellWidth: 35, halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEnd = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? 270;
  const totalY = Math.max(tableEnd, 285);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Qty     ${header.lines.reduce((sum, line) => sum + Number(line.issueQty ?? 1), 0).toFixed(2)}`, 390, totalY + 14);
  doc.text("Sub Total      0.00", 475, totalY + 14);
  doc.text("CGST % 9.00   0.00", 475, totalY + 27);
  doc.text("SGST % 9.00   0.00", 475, totalY + 40);
  doc.text("IGST % 0.00   0.00", 475, totalY + 53);
  doc.text("Total             0.00", 475, totalY + 66);
  doc.text("Total in Words: Rupees Zero Only", 28, totalY + 82);
  doc.setFontSize(12);
  doc.text("NOT FOR SALE", pageW / 2, totalY + 104, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Process to be done   :   ${cell(header.issueFor)}`, 28, totalY + 128);
  doc.text("Remarks                  :   SEND FOR OWN USE", 28, totalY + 142);
  doc.text("Packages                 :   Bundle", 28, totalY + 156);
  doc.text("Transport Mode       :   By Road", 28, totalY + 170);
  doc.text("Please mention our DC.No with Sl No. in your Invoice/DC No", 28, totalY + 194);
  drawSignatures(doc, header, Math.min(totalY + 230, 760));

  doc.addPage();
  drawPageBase(doc, header, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Terms & Conditions:", 28, 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let y = 154;
  TERMS.forEach((term, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${term}`, width - 16) as string[];
    doc.text(lines, 28, y);
    y += lines.length * 9 + 4;
  });
  drawSignatures(doc, header, Math.max(y + 24, 690));

  return Buffer.from(doc.output("arraybuffer"));
}
