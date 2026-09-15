const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Add missing LOM columns to DailyAttendance
  console.log('Adding LOM columns to DailyAttendance...');
  await p.$executeRaw`ALTER TABLE [DailyAttendance] ADD [lomApprovalStatus] NVARCHAR(20) NULL`;
  console.log('  + lomApprovalStatus');
  await p.$executeRaw`ALTER TABLE [DailyAttendance] ADD [lomApprovedMinutes] INT NULL`;
  console.log('  + lomApprovedMinutes');
  await p.$executeRaw`ALTER TABLE [DailyAttendance] ADD [lomActionByUserId] INT NULL`;
  console.log('  + lomActionByUserId');
  await p.$executeRaw`ALTER TABLE [DailyAttendance] ADD [lomActionAt] DATETIME2 NULL`;
  console.log('  + lomActionAt');
  await p.$executeRaw`ALTER TABLE [DailyAttendance] ADD [lomRejectionReason] NVARCHAR(500) NULL`;
  console.log('  + lomRejectionReason');

  // Verify
  const result = await p.$queryRaw`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'DailyAttendance' 
    AND COLUMN_NAME LIKE '%lom%'
  `;
  console.log('\nLOM columns now in DailyAttendance:');
  result.forEach(r => console.log(`  ${r.COLUMN_NAME}`));

  await p.$disconnect();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
