import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedManagerHierarchy() {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO' } });
  if (!company) {
    console.error('Company KUNAERO not found');
    process.exit(1);
  }

  // Get all employees for KUNAERO
  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, deletedAt: null },
    include: {
      jobInfos: { where: { effectiveTo: null }, take: 1 },
    },
    orderBy: { employeeCode: 'asc' },
  });

  if (employees.length === 0) {
    console.error('No employees found for KUNAERO');
    process.exit(1);
  }

  console.log(`Found ${employees.length} employees in ${company.name} (${company.code})`);

  // Fetch designations
  const designations = await prisma.designation.findMany();
  const getDesigId = (name) => designations.find((d) => d.name.toLowerCase() === name.toLowerCase())?.id;

  // Fetch departments
  const departments = await prisma.department.findMany();
  const getDeptId = (name) => departments.find((d) => d.name.toLowerCase() === name.toLowerCase())?.id;

  const gmDesig = getDesigId('GENERAL MANAGER') ?? designations[0]?.id;
  const prodMgrDesig = getDesigId('PRODUCTION MANAGER') ?? gmDesig;
  const qualMgrDesig = getDesigId('QUALITY MANAGER') ?? gmDesig;
  const shiftIncDesig = getDesigId('SHIFT INCHARGE') ?? prodMgrDesig;
  const qualIncDesig = getDesigId('QUALITY INCHARGE') ?? qualMgrDesig;
  const cncOpDesig = getDesigId('CNC OPERATOR') ?? getDesigId('OPERATOR') ?? gmDesig;
  const vmcOpDesig = getDesigId('VMC OPERATOR') ?? cncOpDesig;
  const setterDesig = getDesigId('SETTER') ?? cncOpDesig;
  const inspectorDesig = getDesigId('LINE INSPECTOR') ?? cncOpDesig;
  const operatorDesig = getDesigId('OPERATOR') ?? cncOpDesig;

  const mgmtDept = getDeptId('MANAGEMENT REPRESENTATIVE') ?? getDeptId('ADMINISTRATION') ?? getDeptId('OPERATIONS') ?? departments[0]?.id;
  const prodDept = getDeptId('PRODUCTION') ?? departments[0]?.id;
  const qualDept = getDeptId('QUALITY') ?? departments[0]?.id;

  // Helper to update employee job info
  async function updateJob(employeeId, desigId, deptId) {
    const activeJob = await prisma.jobInfo.findFirst({
      where: { employeeId, effectiveTo: null },
    });
    if (activeJob) {
      await prisma.jobInfo.update({
        where: { id: activeJob.id },
        data: { designationId: desigId, departmentId: deptId },
      });
    }
  }

  // Find employees by code
  const empMap = new Map(employees.map((e) => [e.employeeCode, e]));

  // Leadership setup
  // 1. Root Manager: Suresh (EMP027) - General Manager / Plant Head
  const plantHead = empMap.get('EMP027') || employees[0];
  await prisma.employee.update({
    where: { id: plantHead.id },
    data: { reportingManagerId: null, secondReportingManagerId: null },
  });
  await updateJob(plantHead.id, gmDesig, mgmtDept);
  console.log(`✓ ${plantHead.firstName} ${plantHead.lastName} (${plantHead.employeeCode}) -> GENERAL MANAGER (Root)`);

  // 2. Production Manager: Vinothkumar (EMP029) -> reports to Plant Head
  const prodMgr = empMap.get('EMP029');
  if (prodMgr) {
    await prisma.employee.update({
      where: { id: prodMgr.id },
      data: { reportingManagerId: plantHead.id, secondReportingManagerId: null },
    });
    await updateJob(prodMgr.id, prodMgrDesig, prodDept);
    console.log(`✓ ${prodMgr.firstName} ${prodMgr.lastName} (${prodMgr.employeeCode}) -> PRODUCTION MANAGER (reports to ${plantHead.firstName})`);
  }

  // 3. Quality Manager: Sudharshan R (EMP039) -> reports to Plant Head
  const qualMgr = empMap.get('EMP039');
  if (qualMgr) {
    await prisma.employee.update({
      where: { id: qualMgr.id },
      data: { reportingManagerId: plantHead.id, secondReportingManagerId: null },
    });
    await updateJob(qualMgr.id, qualMgrDesig, qualDept);
    console.log(`✓ ${qualMgr.firstName} ${qualMgr.lastName} (${qualMgr.employeeCode}) -> QUALITY MANAGER (reports to ${plantHead.firstName})`);
  }

  // 4. Shift Incharge A: Lingu Prasath (EMP035) -> reports to Production Manager
  const shiftIncA = empMap.get('EMP035');
  if (shiftIncA && prodMgr) {
    await prisma.employee.update({
      where: { id: shiftIncA.id },
      data: { reportingManagerId: prodMgr.id, secondReportingManagerId: plantHead.id },
    });
    await updateJob(shiftIncA.id, shiftIncDesig, prodDept);
    console.log(`✓ ${shiftIncA.firstName} ${shiftIncA.lastName} (${shiftIncA.employeeCode}) -> SHIFT INCHARGE A (reports to ${prodMgr.firstName})`);
  }

  // 5. Shift Incharge B: Dhayanidhi (EMP037) -> reports to Production Manager
  const shiftIncB = empMap.get('EMP037');
  if (shiftIncB && prodMgr) {
    await prisma.employee.update({
      where: { id: shiftIncB.id },
      data: { reportingManagerId: prodMgr.id, secondReportingManagerId: plantHead.id },
    });
    await updateJob(shiftIncB.id, shiftIncDesig, prodDept);
    console.log(`✓ ${shiftIncB.firstName} ${shiftIncB.lastName} (${shiftIncB.employeeCode}) -> SHIFT INCHARGE B (reports to ${prodMgr.firstName})`);
  }

  // 6. Quality Incharge: Roshini (EMP033) -> reports to Quality Manager
  const qualInc = empMap.get('EMP033');
  if (qualInc && qualMgr) {
    await prisma.employee.update({
      where: { id: qualInc.id },
      data: { reportingManagerId: qualMgr.id, secondReportingManagerId: plantHead.id },
    });
    await updateJob(qualInc.id, qualIncDesig, qualDept);
    console.log(`✓ ${qualInc.firstName} ${qualInc.lastName} (${qualInc.employeeCode}) -> QUALITY INCHARGE (reports to ${qualMgr.firstName})`);
  }

  // 7. Team Shift A: Divya (EMP028), Bhuvana (EMP030), Thenpandi (EMP031), Sandhiya (EMP032), Gokul (EMP034)
  const teamACodes = ['EMP028', 'EMP030', 'EMP031', 'EMP032', 'EMP034'];
  for (let i = 0; i < teamACodes.length; i++) {
    const code = teamACodes[i];
    const emp = empMap.get(code);
    if (emp && shiftIncA && prodMgr) {
      const desig = i % 2 === 0 ? cncOpDesig : vmcOpDesig;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { reportingManagerId: shiftIncA.id, secondReportingManagerId: prodMgr.id },
      });
      await updateJob(emp.id, desig, prodDept);
      console.log(`✓ ${emp.firstName} (${emp.employeeCode}) -> Operator (reports to ${shiftIncA.firstName})`);
    }
  }

  // 8. Team Shift B: Employee 1 (EMP026), Naveen (EMP036), Dharani (EMP038), Parthiban (EMP040), Namita (EMP041)
  const teamBCodes = ['EMP026', 'EMP036', 'EMP038', 'EMP040', 'EMP041'];
  for (let i = 0; i < teamBCodes.length; i++) {
    const code = teamBCodes[i];
    const emp = empMap.get(code);
    if (emp && shiftIncB && prodMgr) {
      const desig = i % 2 === 0 ? setterDesig : inspectorDesig;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { reportingManagerId: shiftIncB.id, secondReportingManagerId: prodMgr.id },
      });
      await updateJob(emp.id, desig, prodDept);
      console.log(`✓ ${emp.firstName} (${emp.employeeCode}) -> Operator (reports to ${shiftIncB.firstName})`);
    }
  }

  console.log('\n✅ Hierarchy and designations seeded successfully!');
}

async function main() {
  try {
    console.log('=== Seeding Manager Hierarchy & Roles ===\n');
    await seedManagerHierarchy();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
