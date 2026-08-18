import "dotenv/config";
import * as xlsx from "xlsx";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Excel date to JS Date
function excelDateToJSDate(excelDate: number | string) {
  if (typeof excelDate === "number") {
    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  }
  // Try to parse if it's a string date
  const d = new Date(excelDate);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

async function main() {
  const filePath = path.resolve("./docs/2. Master List of defective instrument list -2026.xlsx");
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  // Skip the first 2 rows (headers)
  const rows = data.slice(2);
  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[1]) continue;

    const toolOrGaugeNo = String(row[1]).trim();
    if (!toolOrGaugeNo) continue;

    const rejectedDateRaw = row[8];
    let reportedDate = excelDateToJSDate(rejectedDateRaw);
    
    const reasonForRejection = String(row[9] || "Defective").trim().slice(0, 1000);

    try {
      // Find the tool
      const tool = await prisma.gaugeAndTools.findUnique({
        where: { toolOrGaugeNo },
      });

      if (!tool) {
        console.warn(`Tool not found in DB: ${toolOrGaugeNo}`);
        notFoundCount++;
        continue;
      }

      // Insert defect
      await prisma.instrumentDefect.create({
        data: {
          refNo: tool.refNo,
          toolOrGaugeNo: tool.toolOrGaugeNo,
          reportedDate: reportedDate,
          defectDetails: reasonForRejection,
          reportedBy: "System Import",
          status: "Defect Reported"
        }
      });
      successCount++;
    } catch (err) {
      console.error(`Error inserting defect for ${toolOrGaugeNo}:`, err);
      errorCount++;
    }
  }

  console.log(`\nImport completed!`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Tools not found: ${notFoundCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
