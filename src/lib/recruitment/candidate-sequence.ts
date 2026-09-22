/**
 * Application number sequence generator for candidates (BRD §5.3).
 * Format: APP-YYYY-NNNN (e.g. APP-2026-0001).
 * Uses a dedicated counter row in EmployeeIdSequence to avoid coupling
 * with the Employee ID config; mirrors the JD sequence pattern.
 */

import { prisma } from '@/lib/prisma';

const CANDIDATE_SEQ_KEY = 'candidate-app';

export function formatApplicationNo(year: number, n: number): string {
  return `APP-${year}-${String(n).padStart(4, '0')}`;
}

export async function allocateApplicationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: CANDIDATE_SEQ_KEY },
    create: { counterKey: CANDIDATE_SEQ_KEY, lastNumber: 0 },
    update: {},
  });

  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const applicationNo = formatApplicationNo(year, n);
    const taken = await prisma.candidate.findFirst({
      where: { applicationNo },
      select: { id: true },
    });
    if (!taken) {
      await prisma.employeeIdSequence.update({
        where: { counterKey: CANDIDATE_SEQ_KEY },
        data: { lastNumber: n },
      });
      return applicationNo;
    }
  }
  throw new Error('Could not allocate application number after 10000 attempts');
}
