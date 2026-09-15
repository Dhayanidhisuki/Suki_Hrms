const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const [lomConfig, line, att] = await Promise.all([
      p.lomConfig.findUnique({ where: { companyId: 1 } }),
      p.payrollLine.findFirst({ where: { employeeId: 373, payrollRunId: 36 } }),
      p.dailyAttendance.findMany({
        where: { employeeId: 373, date: { gte: new Date('2026-07-01'), lt: new Date('2026-08-01') } },
        include: { shiftMaster: { select: { code: true, graceMinutes: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    console.log('=== How Divya (RC028) LOM for July 2026 is calculated ===\n');
    console.log(`Gross: ${line?.grossEarnings}`);
    console.log(`Total days in July: 31`);
    console.log(`Shift duration: 8 hours`);
    console.log(`LOM config: cap=${lomConfig?.dailyLomCap} min, basis=${lomConfig?.calculationBasis}, multiplier=${lomConfig?.multiplier}`);
    console.log(`\nFormula:`);
    console.log(`  dailyLOM = max(0, late − shiftGrace) + earlyOut`);
    console.log(`  (capped at ${lomConfig?.dailyLomCap} min/day)`);
    console.log(`  perMinuteRate = gross / 31 / 8 / 60`);
    console.log(`  LOM amount = perMinuteRate × totalLOMminutes × multiplier\n`);

    console.log('Date       | Shift     | Late | Early | Grace | Late after grace | Early | Daily LOM');
    console.log('-----------|-----------|------|-------|-------|------------------|-------|----------');
    let totalLom = 0;
    for (const d of att) {
      if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) continue;
      const grace = d.shiftMaster?.graceMinutes ?? lomConfig?.graceMinutesExempt ?? 0;
      const lateAfterGrace = Math.max(0, (d.lateMinutes || 0) - grace);
      const lom = Math.min(lateAfterGrace + (d.earlyOutMinutes || 0), lomConfig?.dailyLomCap || 240);
      totalLom += lom;
      console.log(`${d.date.toISOString().slice(0,10)} | ${(d.shiftMaster?.code || '—').padEnd(9)} | ${String(d.lateMinutes || 0).padStart(4)} | ${String(d.earlyOutMinutes || 0).padStart(5)} | ${String(grace).padStart(5)} | ${String(lateAfterGrace).padStart(16)} | ${String(d.earlyOutMinutes || 0).padStart(5)} | ${String(lom).padStart(9)}`);
    }

    const perMinuteRate = Number(line?.grossEarnings) / 31 / 8 / 60;
    console.log(`\nTotal LOM minutes = ${totalLom}`);
    console.log(`perMinuteRate = ${line?.grossEarnings} / 31 / 8 / 60 = ${perMinuteRate.toFixed(4)}`);
    console.log(`LOM amount = ${perMinuteRate.toFixed(4)} × ${totalLom} × 1 = ${(perMinuteRate * totalLom).toFixed(2)}`);
    console.log(`Stored LOM amount = ${line?.lomAmount}`);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await p.$disconnect();
})();
