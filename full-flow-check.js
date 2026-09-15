const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check OT approval stats
  const approved = await p.dailyAttendance.count({
    where: { otApprovalStatus: 'approved', employee: { companyId: 1, isActive: true } },
  });
  const pendingMgr = await p.dailyAttendance.count({
    where: { otApprovalStatus: 'pending_manager', employee: { companyId: 1, isActive: true } },
  });
  const pendingHr = await p.dailyAttendance.count({
    where: { otApprovalStatus: 'pending_hr', employee: { companyId: 1, isActive: true } },
  });
  console.log('=== OT Stats ===');
  console.log('  Approved:', approved);
  console.log('  Pending Manager:', pendingMgr);
  console.log('  Pending HR:', pendingHr);

  // Sample approved
  const sample = await p.dailyAttendance.findMany({
    where: { otApprovalStatus: 'approved', employee: { companyId: 1, isActive: true } },
    include: { employee: { select: { employeeCode: true, firstName: true } } },
    take: 5,
  });
  console.log('\nSample approved OT:');
  sample.forEach(s => console.log('  emp=' + s.employee.employeeCode, 'date=' + s.date.toISOString().slice(0,10), 'settlement=' + s.otSettlementType, 'OTmin=' + s.otMinutesApproved));

  // Check LOM stats
  const lomApproved = await p.dailyAttendance.count({
    where: { lomApprovalStatus: 'approved', employee: { companyId: 1, isActive: true } },
  });
  const lomPending = await p.dailyAttendance.count({
    where: { lomApprovalStatus: 'pending', employee: { companyId: 1, isActive: true } },
  });
  const lomRejected = await p.dailyAttendance.count({
    where: { lomApprovalStatus: 'rejected', employee: { companyId: 1, isActive: true } },
  });
  console.log('\n=== LOM Stats ===');
  console.log('  Approved:', lomApproved);
  console.log('  Pending:', lomPending);
  console.log('  Rejected:', lomRejected);

  // Check weekly off worked
  const weeklyOffWorked = await p.dailyAttendance.count({
    where: { isWeeklyOffWorked: true, employee: { companyId: 1, isActive: true } },
  });
  console.log('\n=== Weekly Off Worked ===');
  console.log('  Count:', weeklyOffWorked);

  // Check shift change requests
  const scrCount = await p.shiftChangeRequest.count({ where: { employee: { companyId: 1 } } });
  console.log('\n=== Shift Change Requests ===');
  console.log('  Total:', scrCount);

  // Check approval chain config
  const chainConfigs = await p.approvalChainConfig.findMany({ where: { companyId: 1 } });
  console.log('\n=== Approval Chain Config ===');
  console.log('  Total stages:', chainConfigs.length);
  chainConfigs.forEach(c => console.log('  module=' + c.module, 'stage=' + c.stageOrder, c.stageName, c.approverType));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
