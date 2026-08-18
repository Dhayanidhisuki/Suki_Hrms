import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";

const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

const columns = [];
for (let i = 0; i < 20; i++) {
  columns.push(`Col${i}`);
}

const row = [];
for (let i = 0; i < 20; i++) {
  row.push(`VERYLONGSTRINGWITHOUTSPACES40CHARSMAX123`);
}

const rows = [];
for (let i = 0; i < 100; i++) {
  rows.push(row);
}

autoTable(doc, {
  head: [columns],
  body: rows,
  styles: {
    fontSize: 7,
    cellPadding: 2,
    overflow: "ellipsize",
  },
});

const arrayBuffer = doc.output("arraybuffer");
fs.writeFileSync("scratch/test_autotable.pdf", Buffer.from(arrayBuffer));
console.log("PDF generated. length:", arrayBuffer.byteLength);
