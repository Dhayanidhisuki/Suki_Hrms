const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const result = await p.$queryRaw`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'DailyAttendance' 
    AND COLUMN_NAME LIKE '%lom%'
    ORDER BY ORDINAL_POSITION
  `;
  console.log('LOM columns in DailyAttendance:');
  result.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

  const result2 = await p.$queryRaw`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'DailyAttendance' 
    AND COLUMN_NAME IN ('isWeeklyOffWorked', 'isHolidayWorked', 'otSettlementType')
    ORDER BY ORDINAL_POSITION
  `;
  console.log('\nWeekly off / holiday columns:');
  result2.forEach(r => console.log(`  ${r.COLUMN_NAME}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
