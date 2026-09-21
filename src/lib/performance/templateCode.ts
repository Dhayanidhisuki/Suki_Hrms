/**
 * Goal template codes — GT-0001, GT-0002, … per company.
 *
 * Parsing is a pure function so the increment rule can be unit-tested
 * without Prisma. The DB lookup lives next to it.
 */

import { prisma } from '@/lib/prisma';

const PREFIX = 'GT-';

export function nextTemplateCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^GT-(\d+)$/i.exec(code.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${PREFIX}${String(max + 1).padStart(4, '0')}`;
}

export async function allocateTemplateCode(companyId: number): Promise<string> {
  const rows = await prisma.goalTemplate.findMany({
    where: { companyId },
    select: { code: true },
  });
  return nextTemplateCode(rows.map((r) => r.code));
}
