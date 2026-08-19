import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getManproLogoDataUrl } from "@/lib/pdfBranding";
import { drawPdfQr } from "@/lib/pdfQr";

export type DcPdfLine = {
  toolOrGaugeNo: string | null;
  name?: string | null;
  grouping?: string | null;
  description?: string | null;
  type?: string | null;
  destinationUnit?: string | null;
  usedLocation?: string | null;
  issueQty?: number | null;
  serialNo?: string | number | null;
  dueDate?: string | Date | null;
  calibDueDate?: string | Date | null;
  status?: string | null;
  remarks?: string | null;
  machine?: string | null;
  price?: number | null;
  rcNo?: string | null;
  heatNo?: string | null;
  materialSpec?: string | null;
};

export type DcType = "ISSUE" | "CALIBRATION" | "MOVEMENT";

export type DcPdfHeader = {
  dcType?: DcType;
  dcNo: number | string;
  recipientName?: string | null;
  receiveName?: string | null;
  receiver?: string | null;
  fromUnit?: string | null;
  purpose?: string | null;
  subCode?: string | null;
  natureOfWork?: string | null;
  issueDate?: string | Date | null;
  issueFor?: string | null;
  toolsPoNo?: string | null;
  status?: string | null;
  lines: DcPdfLine[];
  companyName?: string | null;
  dueDate?: string | Date | null;
  returnable?: string | null;
  transportName?: string | null;
  vehicleNo?: string | null;
  comments?: string | null;
  netWeight?: string | null;
  packages?: string | null;
  preparedBy?: string | null;
  verificationUrl?: string | null;
  recipientAddress1?: string | null;
  recipientAddress2?: string | null;
  recipientGstin?: string | null;
};

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  if (v instanceof Date) {
    const d = String(v.getDate()).padStart(2, "0");
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const y = v.getFullYear();
    return `${d}-${m}-${y}`;
  }
  const s = String(v);
  if (s.includes("T")) {
    const [y, m, d] = s.split("T")[0].split("-");
    if (y && m && d) return `${d}-${m}-${y}`;
  }
  return s.slice(0, 10);
}

/** Convert INR numbers to words e.g. "Rupees One Lakh Eighteen Thousand..." */
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "Rupees Zero Only";
  const [rupeesStr, paiseStr] = amount.toFixed(2).split(".");
  let rupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr, 10);

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertChunk(n: number): string {
    if (n < 20) return units[n];
    const digit = n % 10;
    return `${tens[Math.floor(n / 10)]}${digit ? " " + units[digit] : ""}`;
  }

  let words = "";
  if (rupees >= 10000000) {
    words += `${convertChunk(Math.floor(rupees / 10000000))} Crore `;
    rupees %= 10000000;
  }
  if (rupees >= 100000) {
    words += `${convertChunk(Math.floor(rupees / 100000))} Lakh `;
    rupees %= 100000;
  }
  if (rupees >= 1000) {
    words += `${convertChunk(Math.floor(rupees / 1000))} Thousand `;
    rupees %= 1000;
  }
  if (rupees >= 100) {
    words += `${convertChunk(Math.floor(rupees / 100))} Hundred `;
    rupees %= 100;
  }
  if (rupees > 0) {
    words += convertChunk(rupees);
  }

  let result = `Rupees ${words.trim()}`;
  if (paise > 0) {
    result += ` & ${convertChunk(paise)} Paise`;
  }
  return result;
}

export function buildDcPdfBuffer(header: DcPdfHeader): Buffer {
  if (header.dcType === "MOVEMENT") {
    return buildMovementDcPdfBuffer(header);
  }
  return buildExternalDcPdfBuffer(header);
}

function buildMovementDcPdfBuffer(data: DcPdfHeader): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const marginX = 20;
  const contentW = width - marginX * 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(marginX, 20, contentW, 75);
  doc.line(500, 20, 500, 95);
  const logo = getManproLogoDataUrl();
  if (logo) doc.addImage(logo, "PNG", 28, 29, 158, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("95.D/3 Ambattur Industrial Estate", 200, 44);
  doc.text("Chennai, Tamil Nadu - 600058", 200, 54);
  doc.text("Phone: 04426243875 · GSTIN: 33AAFCM6958H1Z7", 200, 64);
  doc.text("Email: purchaseorder@manproequipments.com", 200, 74);
  drawPdfQr(doc, data.verificationUrl || `MOVEMENT-DC:${data.dcNo}`, 512, 32, 50);
  doc.setFontSize(5.5);
  doc.text("SCAN TO VERIFY", 537, 89, { align: "center" });
  doc.rect(marginX, 95, contentW, 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("INTERNAL INSTRUMENT MOVEMENT DC", width / 2, 108, { align: "center" });
  doc.setDrawColor(100); doc.line(35, 120, width - 35, 120);
  doc.setFontSize(10);
  doc.text(`DC No: ${data.dcNo}`, 40, 145); doc.text(`Movement Date: ${fmtDate(data.issueDate)}`, 330, 145);
  doc.text(`From Unit: ${data.fromUnit || "—"}`, 40, 165); doc.text(`To Unit: ${data.lines[0]?.destinationUnit || "—"}`, 330, 165);
  doc.text(`Handed To / Receiver: ${data.receiver || data.receiveName || "—"}`, 40, 185); doc.text(`Expected Receipt: ${fmtDate(data.dueDate)}`, 330, 185);
  doc.setFont("helvetica", "normal");
  doc.text(`Purpose: ${data.purpose || data.issueFor || "—"}`, 40, 205);
  autoTable(doc, {
    startY: 224,
    margin: { left: marginX, right: marginX },
    head: [["#", "Instrument / Gauge No.", "Description", "Type", "Used Location", "From Unit", "To Unit", "Status"]],
    body: data.lines.map((line, index) => [
      index + 1,
      line.toolOrGaugeNo || "—",
      line.description || line.name || "—",
      line.type || line.grouping || "—",
      line.usedLocation || "—",
      data.fromUnit || "—",
      line.destinationUnit || "—",
      line.status || "In Movement",
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineWidth: 0.5, lineColor: [0, 0, 0], textColor: [0, 0, 0], overflow: "ellipsize" },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", overflow: "ellipsize" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y = Math.min(((doc as any).lastAutoTable?.finalY ?? 300) + 30, 700);
  doc.setFontSize(9); doc.text(`Comments: ${data.comments || "—"}`, 40, y);
  doc.text(`Prepared By: ${data.preparedBy || "—"}`, 40, y + 55);
  doc.text("Receiver Signature: ____________________", 330, y + 55);
  doc.setFontSize(8); doc.text("System-generated internal movement delivery challan", width / 2, 810, { align: "center" });
  return Buffer.from(doc.output("arraybuffer"));
}

function buildExternalDcPdfBuffer(header: DcPdfHeader): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // ~595.28
  const pageH = doc.internal.pageSize.getHeight(); // ~841.89
  const marginX = 20;
  const contentW = pageW - marginX * 2; // ~555.28

  const formattedDcNo = String(header.dcNo).startsWith("DC/")
    ? String(header.dcNo)
    : `DC/2026-27/${header.dcNo}`;
  const formattedDate = fmtDate(header.issueDate);
  const compName = header.companyName || "Manpro Equipments Private Limited";

  // Helper for Header Box
  function drawCompanyHeader(pageNumber: number) {
    const yStart = 20;

    // Outer Company Header Box
    doc.setLineWidth(0.8);
    doc.setDrawColor(0);
    doc.rect(marginX, yStart, contentW, 75);

    // Vertical separator for QR code
    const qrW = 75;
    doc.line(marginX + contentW - qrW, yStart, marginX + contentW - qrW, yStart + 75);

    // Official Manpro logo extracted from docs/Manpro Logo.pdf.
    const logo = getManproLogoDataUrl();
    if (logo) doc.addImage(logo, "PNG", marginX + 8, yStart + 10, 135, 50);

    // Company address and registration information
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(compName, marginX + 153, yStart + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("95.D/3 Ambattur Industrial Estate, Chennai - 600058", marginX + 153, yStart + 29);
    doc.text("Phone: 04426243875 · GSTIN: 33AAFCM6958H1Z7", marginX + 153, yStart + 42);
    doc.text("Email: purchaseorder@manproequipments.com", marginX + 153, yStart + 55);

    // Draw QR Code
    drawPdfQr(doc, header.verificationUrl || `DC:${header.dcNo}`, marginX + contentW - qrW + 12, yStart + 12, 50);

    // Title Bar Box
    const titleY = yStart + 75;
    doc.rect(marginX, titleY, contentW, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SUB CONTRACT DELIVERY NOTE", pageW / 2, titleY + 14, { align: "center" });

    return titleY + 20;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 1: SUB CONTRACT DELIVERY NOTE FORM
  // ════════════════════════════════════════════════════════════════════════

  let curY = drawCompanyHeader(1);

  // DC No & Date Bar
  doc.rect(marginX, curY, contentW, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`DC No  ${formattedDcNo}`, marginX + 10, curY + 14);
  doc.text(`DC.Date  ${formattedDate}`, marginX + contentW / 2 + 10, curY + 14);
  curY += 20;

  // Address & Logistics Grid (2 Column Split)
  const addrH = 75;
  const colW = contentW / 2;
  doc.rect(marginX, curY, contentW, addrH);
  doc.line(marginX + colW, curY, marginX + colW, curY + addrH);

  // Left Column: Recipient Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const recipientName = header.recipientName || header.receiveName || header.companyName || "M/S.MANPRO EQUIPMENTS PRIVATE LIMITED";
  const recipientUnit = header.subCode ? `(${header.subCode})` : header.issueFor ? `(${header.issueFor})` : "";
  doc.text(`To, ${recipientName}`, marginX + 8, curY + 14);
  if (recipientUnit) doc.text(recipientUnit, marginX + 8, curY + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const addr1 = header.recipientAddress1 || "";
  const addr2 = header.recipientAddress2 || "";
  if (addr1) doc.text(addr1, marginX + 8, curY + 37);
  if (addr2) doc.text(addr2, marginX + 8, curY + 49);
  doc.setFont("helvetica", "bold");
  doc.text(`GSTIN: ${header.recipientGstin || "—"}`, marginX + 8, curY + 65);

  // Right Column: Logistics Metadata
  const rightX = marginX + colW + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Vehicle No", rightX, curY + 14);
  doc.text("SubContractor Copy", rightX, curY + 28);
  doc.text("Acknowledgement Copy", rightX, curY + 42);
  doc.text("Gate Copy", rightX, curY + 56);

  doc.setFont("helvetica", "normal");
  doc.text(`:   ${header.vehicleNo || "—"}`, rightX + 120, curY + 14);
  doc.text(":   SubContractor", rightX + 120, curY + 28);
  doc.text(":   From SubContractor", rightX + 120, curY + 42);
  doc.text(":   MANPRO Security", rightX + 120, curY + 56);

  curY += addrH + 5;

  // Prepare Item Lines Data
  let totalQty = 0;
  let subTotal = 0;

  const tableBody = header.lines.map((line, idx) => {
    const qty = Number(line.issueQty ?? 1);
    const val = Number(line.price ?? 0);
    totalQty += qty;
    subTotal += qty * val;

    const rcNo = line.rcNo || "—";
    const partNo = line.toolOrGaugeNo || "—";
    const partName = line.name || line.grouping || "EQUIPMENT ITEM";
    const heatNo = line.heatNo || (line.serialNo != null ? String(line.serialNo) : "—");
    const matSpec = line.materialSpec || line.grouping || "—";
    const comments = line.remarks || line.status || "—";

    return [
      String(idx + 1).padStart(2, "0"),
      rcNo,
      partNo,
      partName,
      heatNo,
      matSpec,
      comments,
      qty.toFixed(2),
      (qty * val).toFixed(2),
    ];
  });

  // Calculate Tax (9% CGST + 9% SGST standard)
  const cgstRate = 9.0;
  const sgstRate = 9.0;
  const cgstAmt = subTotal * 0.09;
  const sgstAmt = subTotal * 0.09;
  const grandTotal = subTotal + cgstAmt + sgstAmt;
  const totalInWords = numberToWordsINR(grandTotal);

  autoTable(doc, {
    startY: curY,
    tableWidth: contentW,
    head: [["SL.No", "RC No", "Part No", "Part Name", "Heat No", "Material Spec", "Comments", "Qty", "Value"]],
    body: tableBody,
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      overflow: "ellipsize",
    },
    columnStyles: {
      0: { cellWidth: 25, halign: "center" },
      7: { cellWidth: 32, halign: "right" },
      8: { cellWidth: 45, halign: "right" },
    },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? curY + 120;

  // Totals & Tax Summary Table
  doc.setLineWidth(0.5);
  doc.setDrawColor(0);
  const summaryH = 75;
  const summaryW = 160;
  const summaryX = marginX + contentW - summaryW;

  doc.rect(summaryX, finalY, summaryW, summaryH);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");

  const summaryRows = [
    ["Total Qty", totalQty.toFixed(2)],
    ["Sub Total", subTotal.toFixed(2)],
    ["CGST % 9.00", cgstAmt.toFixed(2)],
    ["SGST % 9.00", sgstAmt.toFixed(2)],
    ["IGST % 0.00", "0.00"],
    ["Total", grandTotal.toFixed(2)],
  ];

  let sumY = finalY + 10;
  summaryRows.forEach(([lbl, val], index) => {
    if (index === 5) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(lbl, summaryX + 6, sumY);
    doc.text(val, summaryX + summaryW - 6, sumY, { align: "right" });
    sumY += 11;
  });

  // Words Total Box
  doc.rect(marginX, finalY, contentW - summaryW, summaryH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${totalInWords}`, marginX + 8, finalY + summaryH - 12);
  doc.setFont("helvetica", "bold");
  doc.text("Total in Words:", marginX + 8, finalY + summaryH - 24);

  finalY += summaryH;

  // NOT FOR SALE Instructions Box
  doc.rect(marginX, finalY, contentW, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NOT FOR SALE", pageW / 2, finalY + 16, { align: "center" });

  doc.setFontSize(8);
  const instructY = finalY + 30;
  const instructLeft = [
    ["Process to be done", `:   ${header.natureOfWork || header.purpose || "—"}`],
    ["Remarks", `:   ${header.comments || "SEND FOR OWN USE"}`],
    ["Packages", `:   ${header.packages || "—"}`],
    ["Transport Mode", `:   ${header.transportName || "By Road"}`],
    ["Net.Wt", `:   ${header.netWeight || "—"}`],
  ];

  let iy = instructY;
  instructLeft.forEach(([lbl, val]) => {
    doc.setFont("helvetica", "normal");
    doc.text(lbl, marginX + 10, iy);
    doc.text(val, marginX + 110, iy);
    iy += 11;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Please mention our DC.No with Sl No. in your Invoice/DC No", marginX + 110, finalY + 84);

  finalY += 90 + 15;

  // Signatures Section
  const sigY = pageH - 75;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Prepared By.", marginX + 10, sigY);
  doc.text("Received By.", marginX + contentW / 2 - 20, sigY);
  doc.text(`For ${compName}`, marginX + contentW - 170, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(header.preparedBy || "Ajith", marginX + 10, sigY + 30);
  doc.text("Signature", marginX + contentW / 2 - 20, sigY + 30);
  doc.text("Authorised Signatory", marginX + contentW - 140, sigY + 30);

  // Footer document code line
  const footerY = pageH - 20;
  doc.setFontSize(7.5);
  doc.text("MP-QA-07 / REV 04 / 23.08.2024", marginX + 10, footerY);
  doc.text("Suki ERP V3.5", pageW / 2, footerY, { align: "center" });
  doc.text("Page 1 of 2", pageW - marginX - 10, footerY, { align: "right" });

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 2: TERMS & CONDITIONS
  // ════════════════════════════════════════════════════════════════════════

  doc.addPage();
  curY = drawCompanyHeader(2);

  // Terms & Conditions Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Terms & Conditions:", marginX + 10, curY + 18);
  curY += 26;

  // 18 Official Terms & Conditions
  const terms: string[] = [
    "1.The subcontractor shall perform all work strictly as per the specifications, drawings, and instructions provided by the Manpro.",
    "2.The subcontractor shall complete the work within the agreed schedule. Any delay must be communicated in writing in advance and is subject to approval.",
    "3. All materials supplied by the Manpro must be handled with care. Any loss or damage due to negligence will be charged to the subcontractor.",
    "4.Product must be accompanied by both the COC and inspection report upon dispatch.",
    "5.No substitutions are allowed.",
    "6.Tools and equipment provided by the Manpro must be returned in good condition. Any damage/loss will be recovered.",
    "7.Payments will be made as per mutually agreed terms, subject to approval of quality, quantity, and documentation.",
    "8.If any part of the work is found defective or non-compliant, the subcontractor shall rework it at their own cost without any delay.",
    "9.The subcontractor shall not disclose any technical or commercial information received during the course of work without prior written consent.",
    "10.The supply must include COC and inspection report that adheres to our purchase order requirements, providing detailed as per requirements.",
    "11.All COC and inspection report must be sent before dispatch via email to: documents@manproequipments.com, velu@manproequipments.com.",
    "12.In case of try-out request, ensure you perform Try-out / FA PO requirements, if requested in po line. Also ensure all related/required documents certs are send to our Manpro QA engineer, via email id: documents@manproequipments.com, velu@manproequipments.com and ensure for approval prior to shipping.",
    "13.Any deviations must be submitted using the Manpro Supplier Deviation Request format, exclusively directed to our Manpro QA Engineer via email at documents@manproequipments.com, velu@manproequipments.com.. Approval must be obtained before shipping.",
    "14.Any kind of Repair works not allowed.",
    "15. Supplier shall comply with requirements in FGS15B13.0 (Supplier Quality Procedure) it's applicable for only Emerson fisher products.",
    "16. The quality of the hard copy certificates must be legible and free of peeling or damage. The soft copy needs to be clear and legible.",
    "17.The subcontractor must adhere to all applicable safety norms, guidelines, and statutory requirements at the work site.",
    "18.IF ANY DOUBT, ASK!.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  terms.forEach((term) => {
    const lines = doc.splitTextToSize(term, contentW - 20);
    lines.forEach((l: string) => {
      doc.text(l, marginX + 10, curY);
      curY += 13;
    });
    curY += 2;
  });

  // Page 2 Footer Signatures
  const p2SigY = pageH - 75;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Prepared By.", marginX + 10, p2SigY);
  doc.text("Received By.", marginX + contentW / 2 - 20, p2SigY);
  doc.text(`For ${compName}`, marginX + contentW - 170, p2SigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(header.preparedBy || "Ajith", marginX + 10, p2SigY + 30);
  doc.text("Signature", marginX + contentW / 2 - 20, p2SigY + 30);
  doc.text("Authorised Signatory", marginX + contentW - 140, p2SigY + 30);

  // Page 2 Footer document code
  doc.setFontSize(7.5);
  doc.text("MP-QA-07 / REV 04 / 23.08.2024", marginX + 10, footerY);
  doc.text("Suki ERP V3.5", pageW / 2, footerY, { align: "center" });
  doc.text("Page 2 of 2", pageW - marginX - 10, footerY, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}
