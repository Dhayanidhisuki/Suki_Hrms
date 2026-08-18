import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("==========================================");
  console.log("PHASE 3 DATA INTEGRITY AUDIT RESULTS");
  console.log("==========================================\n");

  // 1. Row-count and orphan check
  console.log("--- 1. Row-count and orphan check ---");
  
  // TOOLS_UNIT_STOCK orphans
  const unitStockOrphans = await prisma.$queryRaw`
    SELECT COUNT(*) as count 
    FROM TOOLS_UNIT_STOCK 
    WHERE REF_NO NOT IN (SELECT REF_NO FROM GAUGEANDTOOLS)
  `;
  console.log("Orphan TOOLS_UNIT_STOCK rows (missing master):", Number((unitStockOrphans as any)[0]?.count || 0));

  // GAUGE_CONTROL_CARD orphans
  const controlCardOrphans = await prisma.$queryRaw`
    SELECT COUNT(*) as count 
    FROM GAUGE_CONTROL_CARD 
    WHERE TOOL_OR_GAUGE_NO NOT IN (SELECT TOOL_OR_GAUGE_NO FROM GAUGEANDTOOLS)
  `;
  console.log("Orphan GAUGE_CONTROL_CARD rows (missing master):", Number((controlCardOrphans as any)[0]?.count || 0));

  // 2. Dedup key correctness
  console.log("\n--- 2. Dedup key correctness ---");
  const duplicateKeys = await prisma.$queryRaw`
    SELECT a.TOOL_OR_GAUGE_NO, b.UNIT_CODE, COUNT(*) as count 
    FROM TOOLS_UNIT_STOCK b 
    JOIN GAUGEANDTOOLS a ON a.REF_NO = b.REF_NO 
    GROUP BY a.TOOL_OR_GAUGE_NO, b.UNIT_CODE 
    HAVING COUNT(*) > 1
  `;
  const dupList = duplicateKeys as any[];
  console.log(`Duplicate (TOOL_OR_GAUGE_NO, USED_UNIT) violations: ${dupList.length}`);
  if (dupList.length > 0) {
    console.log(dupList);
  }

  // 4. Date-format integrity
  // In SQL Server, columns typed as DateTime/Date natively enforce valid date formats.
  // However, we will verify if there are any CAST issues or invalid dates 
  // (e.g. year < 1900 or > 2100 which are sometimes used as placeholders or result from parse errors).
  console.log("\n--- 4. Date-format integrity ---");
  
  const badUnitStockDates = await prisma.$queryRaw`
    SELECT REF_NO, CALIB_DATE, NEXT_CALIB_DATE
    FROM TOOLS_UNIT_STOCK
    WHERE (CALIB_DATE IS NOT NULL AND (YEAR(CALIB_DATE) < 1990 OR YEAR(CALIB_DATE) > 2100))
       OR (NEXT_CALIB_DATE IS NOT NULL AND (YEAR(NEXT_CALIB_DATE) < 1990 OR YEAR(NEXT_CALIB_DATE) > 2100))
  `;
  const badDates1 = badUnitStockDates as any[];
  console.log(`Suspicious CALIB_DATE / NEXT_CALIB_DATE in TOOLS_UNIT_STOCK (e.g. year out of bounds): ${badDates1.length}`);
  if (badDates1.length > 0) {
     console.log("Examples:", badDates1.slice(0, 5));
  }

  const badControlDates = await prisma.$queryRaw`
    SELECT ROW_ID, C_DATE, NEXT_C_DATE
    FROM GAUGE_CONTROL_CARD_TRANS
    WHERE (C_DATE IS NOT NULL AND (YEAR(C_DATE) < 1990 OR YEAR(C_DATE) > 2100))
       OR (NEXT_C_DATE IS NOT NULL AND (YEAR(NEXT_C_DATE) < 1990 OR YEAR(NEXT_C_DATE) > 2100))
  `;
  const badDates2 = badControlDates as any[];
  console.log(`Suspicious C_DATE / NEXT_C_DATE in GAUGE_CONTROL_CARD_TRANS: ${badDates2.length}`);
  if (badDates2.length > 0) {
     console.log("Examples:", badDates2.slice(0, 5));
  }
  
  console.log("\n(Note: SQL Server native Date/DateTime columns strictly reject plain text like '17.07.2026'. If a plain text date was imported, it either failed the import row entirely or mapped to a weird year/NULL).");

  console.log("\n==========================================");
  console.log("Please copy these results back to the chat");
  console.log("==========================================");
}

main()
  .catch((e) => {
    console.error("Script failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
