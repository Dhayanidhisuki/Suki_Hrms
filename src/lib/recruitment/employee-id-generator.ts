/**
 * Employee ID generation helper — uses the company-configurable EmployeeIdConfig
 * (BRD §9). Format: [prefix][separator][year?][separator][dept?][separator][seq]
 */

import { prisma } from '@/lib/prisma';

const EMP_SEQ_KEY = 'employee';

export async function generateEmployeeCode(departmentCode?: string | null): Promise<string> {
  const config = await prisma.employeeIdConfig.findFirst();
  if (!config) {
    // Fallback: simple EMP-0001 format
    return allocateFallback();
  }

  const year = config.includeYear ? String(new Date().getFullYear()) : '';
  const dept = config.includeDepartment ? (departmentCode ?? 'DEPT') : '';

  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: EMP_SEQ_KEY },
    create: { counterKey: EMP_SEQ_KEY, lastNumber: config.startNumber - 1 },
    update: {},
  });

  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const padded = String(n).padStart(config.sequenceLength, '0');
    const parts = [config.prefix, year, dept, padded].filter((p) => p !== '');
    const employeeCode = parts.join(config.separator || '-');

    const taken = await prisma.employee.findFirst({ where: { employeeCode }, select: { id: true } });
    if (!taken) {
      await prisma.employeeIdSequence.update({
        where: { counterKey: EMP_SEQ_KEY },
        data: { lastNumber: n },
      });
      return employeeCode;
    }
  }
  throw new Error('Could not allocate employee code after 10000 attempts');
}

async function allocateFallback(): Promise<string> {
  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: EMP_SEQ_KEY },
    create: { counterKey: EMP_SEQ_KEY, lastNumber: 0 },
    update: {},
  });
  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const employeeCode = `EMP-${String(n).padStart(4, '0')}`;
    const taken = await prisma.employee.findFirst({ where: { employeeCode }, select: { id: true } });
    if (!taken) {
      await prisma.employeeIdSequence.update({ where: { counterKey: EMP_SEQ_KEY }, data: { lastNumber: n } });
      return employeeCode;
    }
  }
  throw new Error('Could not allocate employee code');
}
