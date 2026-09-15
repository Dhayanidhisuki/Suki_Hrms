const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const lines = await p.payrollLine.findMany({
      where: { payrollRunId: 36 },
      include: { employee: { select: { employeeCode: true, firstName: true } } },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    let totGross = 0, totOtherEarn = 0, totPF = 0, totESI = 0, totPT = 0, totTDS = 0, totOtherDed = 0, totLOM = 0, totNet = 0;
    let totEarnings = 0, totDeductions = 0;

    console.log('Code    Gross    OT    OthEarn  Night   PF    ESI  PT  TDS  OthDed  LOM    Net    Earn   Ded');
    console.log('----   ------  ----  -------  -----  ----  ----  --  ---  ------  ----  -----  -----  ---');

    for (const l of lines) {
      const earn = Number(l.grossEarnings) + Number(l.otherEarningsTotal);
      const ded = Number(l.pfEmployee) + Number(l.esiEmployee) + Number(l.professionalTax) + Number(l.tds) + Number(l.otherDeductionsTotal);

      // Get night allowance from components
      const comps = await p.payrollLineComponent.findMany({
        where: { payrollLineId: l.id },
        include: { salaryComponent: { select: { code: true, type: true } } },
      });
      const nightAllow = comps.find(c => c.salaryComponent.code === 'NIGHT_ALLOWANCE')?.amount || 0;

      totGross += Number(l.grossEarnings);
      totOtherEarn += Number(l.otherEarningsTotal);
      totPF += Number(l.pfEmployee);
      totESI += Number(l.esiEmployee);
      totPT += Number(l.professionalTax);
      totTDS += Number(l.tds);
      totOtherDed += Number(l.otherDeductionsTotal);
      totLOM += Number(l.lomAmount);
      totNet += Number(l.netSalary);
      totEarnings += earn;
      totDeductions += ded;

      console.log(
        `${l.employee.employeeCode.padEnd(7)} ${String(l.grossEarnings).padStart(6)} ${String(l.otAmount).padStart(5)} ${String(l.otherEarningsTotal).padStart(7)} ${String(nightAllow).padStart(5)} ${String(l.pfEmployee).padStart(5)} ${String(l.esiEmployee).padStart(4)} ${String(l.professionalTax).padStart(2)} ${String(l.tds).padStart(3)} ${String(l.otherDeductionsTotal).padStart(6)} ${String(l.lomAmount).padStart(5)} ${String(l.netSalary).padStart(6)} ${String(earn).padStart(6)} ${String(ded).padStart(6)}`
      );
    }

    console.log('----   ------  ----  -------  -----  ----  ----  --  ---  ------  ----  -----  -----  ---');
    console.log(
      `TOTAL  ${String(totGross).padStart(6)} ${String('').padStart(5)} ${String(totOtherEarn).padStart(7)} ${String('').padStart(5)} ${String(totPF).padStart(5)} ${String(totESI).padStart(4)} ${String(totPT).padStart(2)} ${String(totTDS).padStart(3)} ${String(totOtherDed).padStart(6)} ${String(totLOM).padStart(5)} ${String(totNet).padStart(6)} ${String(totEarnings).padStart(6)} ${String(totDeductions).padStart(6)}`
    );
    console.log('');
    console.log(`Total Earnings  = ${totEarnings}`);
    console.log(`Total Deductions = ${totDeductions}`);
    console.log(`Total Net Payable = ${totNet}`);
    console.log(`Reconcile: ${totEarnings} - ${totDeductions} = ${totEarnings - totDeductions} (should equal ${totNet})`);
  } catch (e) {
    console.error('ERROR: ' + e.message);
  }
  await p.$disconnect();
})();
