/**
 * Phase 1 setup script — deactivates 76 employees, keeps 12 active,
 * cleans up shifts, creates 4 proper shifts, assigns employees to shifts,
 * creates salary revisions, and sets up a shift rotation plan.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ── 1. Pick 12 employees to keep active ──────────────────────────────
  // 2 General shift: RC027 (372), RC114 (459)
  // 10 Rotational: RC028-RC037 (373-382)
  const keepIds = [372, 459, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382];
  console.log('Keeping active:', keepIds.length, 'employees');

  // Deactivate all others
  const deactivated = await prisma.employee.updateMany({
    where: { companyId: 1, deletedAt: null, isActive: true, id: { notIn: keepIds } },
    data: { isActive: false },
  });
  console.log('Deactivated:', deactivated.count, 'employees');

  // ── 2. Clean up shifts — soft-delete test/duplicate shifts ────────────
  await prisma.shiftMaster.updateMany({
    where: { code: { in: ['001', 'SHF001'] } },
    data: { deletedAt: new Date(), isActive: false },
  });
  console.log('Soft-deleted test shifts: 001, SHF001');

  // ── 3. Update existing 4 shifts ──────────────────────────────────────
  // GENERAL (id=2): 09:00-17:30, grace 15 min
  await prisma.shiftMaster.update({
    where: { id: 2 },
    data: {
      code: 'GENERAL',
      name: 'General Shift',
      startTime: '09:00',
      endTime: '17:30',
      graceMinutes: 15,
      bufferMinutes: 30,
      breakMinutes: 30,
      nightAllowed: false,
      nightAllowanceAmount: 0,
      nightAllowanceFromHour: null,
      isActive: true,
      deletedAt: null,
    },
  });
  console.log('Updated GENERAL shift (id=2)');

  // SHIFT_1 (id=3): 06:00-14:00 — Morning rotational
  await prisma.shiftMaster.update({
    where: { id: 3 },
    data: {
      code: 'MORNING',
      name: 'Morning Shift',
      startTime: '06:00',
      endTime: '14:00',
      graceMinutes: 10,
      bufferMinutes: 30,
      breakMinutes: 30,
      nightAllowed: false,
      isActive: true,
      deletedAt: null,
    },
  });
  console.log('Updated MORNING shift (id=3)');

  // SHIFT_2 (id=4): 14:00-22:00 — Evening rotational
  await prisma.shiftMaster.update({
    where: { id: 4 },
    data: {
      code: 'EVENING',
      name: 'Evening Shift',
      startTime: '14:00',
      endTime: '22:00',
      graceMinutes: 10,
      bufferMinutes: 30,
      breakMinutes: 30,
      nightAllowed: false,
      isActive: true,
      deletedAt: null,
    },
  });
  console.log('Updated EVENING shift (id=4)');

  // SHIFT_3 (id=5): 22:00-06:00 — Night rotational (overnight)
  await prisma.shiftMaster.update({
    where: { id: 5 },
    data: {
      code: 'NIGHT',
      name: 'Night Shift',
      startTime: '22:00',
      endTime: '06:00',
      graceMinutes: 10,
      bufferMinutes: 30,
      breakMinutes: 30,
      nightAllowed: true,
      nightAllowanceAmount: 200,    // ₹200 per night shift worked
      nightAllowanceFromHour: 22,   // from 22:00
      isActive: true,
      deletedAt: null,
    },
  });
  console.log('Updated NIGHT shift (id=5) — nightAllowed=true, allowance=₹200');

  // ── 4. Create Shift Rotation Plan ────────────────────────────────────
  // Weekly rotation: Week 1 = Morning, Week 2 = Evening, Week 3 = Night
  const plan = await prisma.shiftRotationPlan.upsert({
    where: { code: 'ROT_3WEEK' },
    update: {
      name: '3-Week Rotation (Morning→Evening→Night)',
      anchorDate: new Date('2026-07-01'),
      isActive: true,
    },
    create: {
      code: 'ROT_3WEEK',
      name: '3-Week Rotation (Morning→Evening→Night)',
      anchorDate: new Date('2026-07-01'),
      description: 'Weekly rotation: Morning → Evening → Night → repeat',
      isActive: true,
    },
  });
  console.log('Created/updated rotation plan:', plan.code, 'id:', plan.id);

  // Delete old slots and create new ones
  await prisma.shiftRotationSlot.deleteMany({ where: { shiftRotationPlanId: plan.id } });
  await prisma.shiftRotationSlot.createMany({
    data: [
      { shiftRotationPlanId: plan.id, sequenceOrder: 1, shiftMasterId: 3 },  // Morning
      { shiftRotationPlanId: plan.id, sequenceOrder: 2, shiftMasterId: 4 },  // Evening
      { shiftRotationPlanId: plan.id, sequenceOrder: 3, shiftMasterId: 5 },  // Night
    ],
  });
  console.log('Created 3 rotation slots: Morning → Evening → Night');

  // ── 5. Assign employees to shifts ───────────────────────────────────
  // 2 General: RC027 (372), RC114 (459)
  // 10 Rotational: RC028-RC037 (373-382)
  const generalIds = [372, 459];
  const rotationalIds = [373, 374, 375, 376, 377, 378, 379, 380, 381, 382];

  // Update JobInfo for General shift employees
  for (const empId of generalIds) {
    await prisma.jobInfo.updateMany({
      where: { employeeId: empId, effectiveTo: null },
      data: {
        shiftMasterId: 2,          // GENERAL
        shiftAssignmentType: 'GENERAL',
        shiftRotationPlanId: null,
        shiftRequired: true,
      },
    });
  }
  console.log('Assigned', generalIds.length, 'employees to General shift');

  // Update JobInfo for Rotational shift employees
  for (const empId of rotationalIds) {
    await prisma.jobInfo.updateMany({
      where: { employeeId: empId, effectiveTo: null },
      data: {
        shiftMasterId: null,       // resolved from rotation plan
        shiftAssignmentType: 'ROTATIONAL',
        shiftRotationPlanId: plan.id,
        shiftRequired: true,
      },
    });
  }
  console.log('Assigned', rotationalIds.length, 'employees to Rotational shift');

  // ── 6. Create salary revisions for all 12 employees ─────────────────
  // RC114 (459) already has one (id=48, 500000/month from Nov 2026).
  // For the others, create a basic salary revision effective from 2026-07-01.
  // Components: BASIC (id=1) 15000, HRA (id=10) 7000, CONVEYANCE (id=6) 3000
  const salaryComponents = [
    { salaryComponentId: 1, amount: 15000 },  // BASIC
    { salaryComponentId: 10, amount: 7000 },  // HRA
    { salaryComponentId: 6, amount: 3000 },  // CONVEYANCE
  ];

  for (const empId of [...generalIds, ...rotationalIds]) {
    if (empId === 459) continue; // already has salary revision

    // Check if revision already exists
    const existing = await prisma.employeeSalaryRevision.findFirst({
      where: { employeeId: empId, effectiveTo: null },
    });
    if (existing) continue;

    const rev = await prisma.employeeSalaryRevision.create({
      data: {
        employeeId: empId,
        financialYear: '2026-2027',
        grossSalary: 25000,
        netSalary: 25000,
        effectiveFrom: new Date('2026-07-01T00:00:00Z'),
        components: { create: salaryComponents },
      },
    });
    console.log('Created salary revision for emp', empId, 'rev id:', rev.id);
  }

  // Also update RC114's salary revision to be effective from July (for testing)
  // Close the high-salary revisions and create a 25000/month one from July
  await prisma.employeeSalaryRevision.updateMany({
    where: { employeeId: 459, effectiveTo: null },
    data: { effectiveTo: new Date('2026-06-30T00:00:00Z') },
  });
  const rc114Rev = await prisma.employeeSalaryRevision.create({
    data: {
      employeeId: 459,
      financialYear: '2026-2027',
      grossSalary: 25000,
      netSalary: 25000,
      effectiveFrom: new Date('2026-07-01T00:00:00Z'),
      components: { create: salaryComponents },
    },
  });
  console.log('Created new salary revision for RC114 (459), rev id:', rc114Rev.id);

  console.log('\n=== Phase 1 setup complete ===');
  console.log('Active employees:', keepIds.length);
  console.log('General shift:', generalIds.length, 'employees');
  console.log('Rotational shift:', rotationalIds.length, 'employees');
  console.log('Shifts: GENERAL, MORNING, EVENING, NIGHT');
  console.log('Rotation plan: 3-week cycle (Morning→Evening→Night)');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
