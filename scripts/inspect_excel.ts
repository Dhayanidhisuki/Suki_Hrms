import * as xlsx from "xlsx";
import path from "path";

const filePath = path.resolve("./docs/2. Master List of defective instrument list -2026.xlsx");
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log(JSON.stringify(data.slice(0, 5), null, 2));
