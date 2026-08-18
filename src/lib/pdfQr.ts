import type { jsPDF } from "jspdf";
import QRCode from "qrcode";

/** Draw a standards-compliant, vector QR directly into a jsPDF document. */
export function drawPdfQr(doc: jsPDF, value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const quiet = 4;
  const cells = qr.modules.size + quiet * 2;
  const cell = size / cells;
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (qr.modules.data[row * qr.modules.size + col]) {
        doc.rect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.05, cell + 0.05, "F");
      }
    }
  }
}
