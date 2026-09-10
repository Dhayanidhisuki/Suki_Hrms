import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLeaveApplications() {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO' } });
  if (!company) {
    console.log('Company not found');
    process.exit(1);
  }

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
    take: 8,
  });

  if (employees.length === 0) {
    console.log('No employees found');
    return;
  }

  const leaveTypes = await prisma.leaveMaster.findMany({
    where: { companyId: company.id },
    take: 3,
  });

  if (leaveTypes.length === 0) {
    console.log('No leave types found');
    return;
  }

  let count = 0;
  const applications = [
    { employeeId: employees[0].id, leaveTypeId: leaveTypes[0].id, fromDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), toDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: 'PENDING', companyId: company.id },
    { employeeId: employees[1].id, leaveTypeId: leaveTypes[0].id, fromDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), toDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), status: 'APPROVED', companyId: company.id },
    { employeeId: employees[2].id, leaveTypeId: leaveTypes[1].id, fromDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), toDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), status: 'APPROVED', companyId: company.id },
    { employeeId: employees[3].id, leaveTypeId: leaveTypes[2].id, fromDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), toDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), status: 'PENDING', companyId: company.id },
  ];

  for (const app of applications) {
    try {
      await prisma.leaveApplication.create({ data: app });
      count++;
    } catch (e) {
      // Skip duplicates
    }
  }

  console.log(`✓ Created ${count} leave applications`);
}

async function seedAttendance() {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO' } });
  if (!company) {
    console.log('Company not found');
    process.exit(1);
  }

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
    take: 20,
  });

  if (employees.length === 0) {
    console.log('No employees found');
    return;
  }

  let count = 0;
  for (let day = 0; day < 10; day++) {
    const attendanceDate = new Date();
    attendanceDate.setDate(attendanceDate.getDate() - day);

    for (const employee of employees) {
      const status = Math.random() > 0.15 ? 'PRESENT' : Math.random() > 0.5 ? 'ABSENT' : 'LEAVE';
      try {
        await prisma.dailyAttendance.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: employee.id,
              attendanceDate,
            },
          },
          update: { status },
          create: {
            employeeId: employee.id,
            attendanceDate,
            status,
            companyId: company.id,
          },
        });
        count++;
      } catch (e) {
        // Skip errors
      }
    }
  }

  console.log(`✓ Created ${count} attendance records`);
}

async function main() {
  try {
    console.log('=== Seeding Dashboard Data ===\n');
    await seedLeaveApplications();
    await seedAttendance();
    console.log('\n✅ Dashboard data seeded successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
