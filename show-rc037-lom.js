const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const [lomConfig, line, att] = await Promise.all([
      p.lomConfig.findUnique({ where: { companyId: 1 } }),
      p.payrollLine.findFirst({ where: { employee: { employeeCode: 'RC037' }, payrollRunId: 36 } }),
      p.dailyAttendance.findMany({
        where: { employee: { employeeCode: 'RC037' }, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        include: { employee: { select: { firstName: true } }, shiftMaster: { select: { code: true, startTime: true, endTime: true, graceMinutes: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    console.log(`=== RC037 ${att[0]?.employee?.firstName ?? 'Dhayanidhi'} July 2026 LOM Breakdown ===\n`);
    console.log(`Gross Salary: ${line?.grossEarnings}`);
    console.log(`LOM Deduction Amount: ${line?.lomAmount}`);
    console.log(`LOM Config: grace=${lomConfig?.graceMinutesExempt} min, cap=${lomConfig?.dailyLomCap} min, basis=${lomConfig?.calculationBasis}, multiplier=${lomConfig?.multiplier}`);
    console.log('');

    console.log('Day-by-day LOM minutes:');
    console.log('Date       | Shift     | Late | Early | Grace | LOM');
    console.log('-----------|-----------|------|-------|-------|------');
    let totalLom = 0;
    for (const d of att) {
      if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) continue;
      const grace = d.shiftMaster?.graceMinutes ?? lomConfig?.graceMinutesExempt ?? 0;
      const lateAfterGrace = Math.max(0, (d.lateMinutes || 0) - grace);
      const lom = Math.min(lateAfterGrace + (d.earlyOutMinutes || 0), lomConfig?.dailyLomCap || 240);
      totalLom += lom;
      console.log(`${d.date.toISOString().slice(0,10)} | ${(d.shiftMaster?.code || '—').padEnd(9)} | ${String(d.lateMinutes || 0).padStart(4)} | ${String(d.earlyOutMinutes || 0).padStart(5)} | ${String(grace).padStart(5)} | ${String(lom).padStart(4)}`);
    }
    console.log(`\nTotal LOM minutes in July: ${totalLom}`);
    console.log(`LOM Amount deducted: ${line?.lomAmount}`);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await p.$disconnect();
})();
