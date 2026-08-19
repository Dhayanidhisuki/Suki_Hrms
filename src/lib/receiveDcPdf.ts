import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getManproLogoDataUrl } from "@/lib/pdfBranding";
import { drawPdfQr } from "@/lib/pdfQr";

export type ReceiveDcPdfData = {
  recNo: number;
  issueDcNo: string;
  receiveDate: Date | string | null;
  receivedFrom: string | null;
  receivedBy: string | null;
  fromUnit: string | null;
  toUnit: string | null;
  location: string | null;
  movement: boolean;
  verificationUrl: string;
  lines: Array<{
    toolNo: string | null;
    description: string | null;
    size: string | null;
    serialNo: number | null;
    quantity: number;
    status: string | null;
  }>;
};

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB").format(date).replaceAll("/", "-");
}

export function buildReceiveDcPdfBuffer(data: ReceiveDcPdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 24;
  const contentWidth = width - margin * 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(margin, 22, contentWidth, 78);
  doc.line(width - 96, 22, width - 96, 100);
  const logo = getManproLogoDataUrl();
  if (logo) doc.addImage(logo, "PNG", margin + 8, 33, 145, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("95.D/3 Ambattur Industrial Estate", 190, 45);
  doc.text("Chennai, Tamil Nadu - 600058", 190, 57);
  doc.text("Phone: 04426243875 · GSTIN: 33AAFCM6958H1Z7", 190, 69);
  doc.text("Email: purchaseorder@manproequipments.com", 190, 81);
  drawPdfQr(doc, data.verificationUrl, width - 84, 31, 54);
  doc.setFontSize(5.5);
  doc.text("SCAN TO VERIFY", width - 57, 93, { align: "center" });

  doc.rect(margin, 100, contentWidth, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.movement ? "INTERNAL MOVEMENT RECEIVE DC" : "TOOLS RECEIVE DC", width / 2, 116, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Receive DC No: REC-${data.recNo}`, 38, 151);
  doc.text(`Receive Date: ${formatDate(data.receiveDate)}`, 325, 151);
  doc.text(`Against Issue DC: ${data.issueDcNo}`, 38, 173);
  doc.text(`Status: RECEIVED`, 325, 173);
  doc.text(`From Unit: ${data.fromUnit || "—"}`, 38, 195);
  doc.text(`To Unit: ${data.toUnit || "—"}`, 325, 195);
  doc.text(`Received From: ${data.receivedFrom || "—"}`, 38, 217);
  doc.text(`Destination / Rack: ${data.location || "—"}`, 325, 217);

  autoTable(doc, {
    startY: 240,
    margin: { left: margin, right: margin },
    head: [["#", "Instrument / Tool No.", "Description", "Size", "S.No", "Qty", "Status"]],
    body: data.lines.map((line, index) => [
      index + 1,
      line.toolNo || "—",
      line.description || "—",
      line.size || "—",
      line.serialNo ?? "—",
      line.quantity,
      line.status || "Received",
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineWidth: 0.4, lineColor: [80, 80, 80], textColor: [0, 0, 0], overflow: "ellipsize" },
    headStyles: { fillColor: [238, 242, 247], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEnd = (doc as any).lastAutoTable?.finalY ?? 340;
  const signatureY = Math.min(tableEnd + 65, 750);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Received By: ${data.receivedBy || "—"}`, 38, signatureY);
  doc.text("Receiver Signature: ____________________", 330, signatureY);
  doc.setFontSize(7);
  doc.text("System-generated receive delivery challan", width / 2, 815, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}
