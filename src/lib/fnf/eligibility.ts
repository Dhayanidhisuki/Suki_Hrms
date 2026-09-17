import { prisma } from '@/lib/prisma';
import { FNF_CLEARANCE_CODES } from '@/lib/fnf/types';
import { isClearanceCleared } from '@/lib/fnf/rules';

export type EligibilityIssue = { code: string; message: string };

export { isClearanceCleared };

export async function fnfEligibility(exitInterviewId: number, companyId: number): Promise<{
  ok: boolean;
  issues: EligibilityIssue[];
  clearanceCleared: boolean;
  clearanceRequired: boolean;
}> {
  const exit = await prisma.exitInterview.findFirst({
    where: { id: exitInterviewId, employee: { companyId } },
    include: {
      fnfSettlement: { select: { id: true, status: true } },
      clearanceChecks: true,
    },
  });
  const issues: EligibilityIssue[] = [];
  if (!exit) {
    return { ok: false, issues: [{ code: 'NO_SEPARATION', message: 'A valid separation record is required' }], clearanceCleared: false, clearanceRequired: true };
  }
  if (exit.fnfSettlement && exit.fnfSettlement.status === 'completed') {
    issues.push({ code: 'COMPLETED', message: 'This separation already has a completed F&F' });
  }
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId } });
  const clearanceRequired = config?.clearanceRequired !== false;
  const checks = exit.clearanceChecks;
  const allCleared = isClearanceCleared(checks, exit.clearanceStatus);
  if (clearanceRequired && !allCleared) {
    issues.push({ code: 'CLEARANCE', message: 'Exit clearance is not complete (Manager, IT, Finance, HR)' });
  }
  return { ok: issues.length === 0, issues, clearanceCleared: allCleared, clearanceRequired };
}

export async function ensureClearanceChecks(exitInterviewId: number) {
  for (const checkCode of FNF_CLEARANCE_CODES) {
    await prisma.exitClearanceCheck.upsert({
      where: { exitInterviewId_checkCode: { exitInterviewId, checkCode } },
      create: { exitInterviewId, checkCode, status: 'PENDING' },
      update: {},
    });
  }
}
