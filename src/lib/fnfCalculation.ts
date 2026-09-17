import { prisma } from '@/lib/prisma';
import { calculateFnFFromFreeze } from '@/lib/fnf/engine';
import { gatherFnfFreeze } from '@/lib/fnf/freeze';
import { takeSnapshot, supersedeSnapshot } from '@/lib/platform/snapshot/service';
import type { FnFCalculation, FnFLineDraft } from '@/lib/fnf/types';
import { netFromLines } from '@/lib/fnf/rules';

export type { FnFCalculation, FnFLineDraft };

export interface CalculateFnFOverrides {
  noticeServedDays?: number;
  noticeWaivedDays?: number;
  clearanceOverrideRemark?: string;
}

export async function calculateFnF(
  employeeId: number,
  exitInterviewId: number,
  companyId: number,
  overrides?: CalculateFnFOverrides,
  actor?: { userId: number | null },
  existingFreezeId?: number | null,
): Promise<FnFCalculation> {
  if (overrides?.noticeServedDays != null || overrides?.noticeWaivedDays != null) {
    await prisma.exitInterview.update({
      where: { id: exitInterviewId },
      data: {
        ...(overrides.noticeServedDays != null ? { noticeServedDays: overrides.noticeServedDays } : {}),
        ...(overrides.noticeWaivedDays != null ? { noticeWaivedDays: overrides.noticeWaivedDays } : {}),
      },
    });
  }

  const freeze = await gatherFnfFreeze(employeeId, exitInterviewId, companyId);
  if (overrides?.noticeServedDays != null) freeze.noticeServedDays = overrides.noticeServedDays;
  if (overrides?.noticeWaivedDays != null) freeze.noticeWaivedDays = overrides.noticeWaivedDays;

  const platformActor = { userId: actor?.userId ?? null, source: 'system' as const };
  let freezeSnapshotId: number | undefined;
  try {
    if (existingFreezeId) {
      const next = await supersedeSnapshot({
        companyId,
        id: existingFreezeId,
        reason: 'F&F recalculated',
        actor: platformActor,
        newContent: freeze,
      });
      freezeSnapshotId = next.id;
    } else {
      const snap = await takeSnapshot({
        companyId,
        snapshotTypeCode: 'FNF_INPUT_FREEZE',
        sourceEntityType: 'FnfSettlement',
        sourceEntityId: exitInterviewId,
        content: freeze,
        actor: platformActor,
      });
      freezeSnapshotId = snap.id;
    }
  } catch {
    freezeSnapshotId = existingFreezeId ?? undefined;
  }

  const { calc } = await calculateFnFFromFreeze(freeze, employeeId);
  return {
    ...calc,
    snapshotJson: JSON.stringify(freeze),
    freezeSnapshotId,
  };
}

export async function persistFnFCalculation(settlementId: number, calc: FnFCalculation, userId: number) {
  const { lines, freezeSnapshotId, ...fields } = calc;
  await prisma.$transaction(async (tx) => {
    const manuals = await tx.fnFSettlementLine.findMany({ where: { settlementId, source: 'MANUAL' } });
    const merged: FnFLineDraft[] = [
      ...lines,
      ...manuals.map((l) => ({
        kind: l.kind as FnFLineDraft['kind'],
        code: l.code,
        name: l.name,
        source: 'MANUAL' as const,
        amount: Number(l.amount),
        editable: true,
        remark: l.remark ?? undefined,
      })),
    ];
    const totals = netFromLines(merged);
    await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        unpaidSalary: fields.unpaidSalary,
        leaveEncashment: fields.leaveEncashment,
        leaveEncashmentDays: fields.leaveEncashmentDays,
        gratuity: fields.gratuity,
        bonusProportion: fields.bonusProportion,
        noticePay: fields.noticePay,
        loanRecovery: fields.loanRecovery,
        assetRecovery: fields.assetRecovery,
        otherPayments: fields.otherPayments,
        otherDeductions: fields.otherDeductions,
        arrearsAmount: fields.arrearsAmount,
        incentiveAmount: fields.incentiveAmount,
        tdsDeduction: fields.tdsDeduction,
        pfDeduction: fields.pfDeduction,
        esiDeduction: fields.esiDeduction,
        payableDays: fields.payableDays,
        salaryDivisor: fields.salaryDivisor,
        noticeServedDays: fields.noticeServedDays,
        noticeWaivedDays: fields.noticeWaivedDays,
        noticeShortfallDays: fields.noticeShortfallDays,
        snapshotJson: fields.snapshotJson,
        freezeSnapshotId: freezeSnapshotId ?? undefined,
        totalPayable: totals.totalPayable,
        totalRecovery: totals.totalRecovery,
        netPayable: totals.netPayable,
        status: 'calculated',
        calculatedByUserId: userId,
        calculatedAt: new Date(),
      },
    });
    await tx.fnFSettlementLine.deleteMany({ where: { settlementId } });
    if (merged.length) {
      await tx.fnFSettlementLine.createMany({
        data: merged.map((l, i) => ({
          settlementId,
          kind: l.kind,
          code: l.code,
          name: l.name,
          source: l.source,
          amount: l.amount,
          editable: l.editable,
          remark: l.remark ?? null,
          sortOrder: i,
        })),
      });
    }
  });
}

export function buildJournal(settlement: { netPayable: unknown; totalPayable: unknown; totalRecovery: unknown; employeeId: number }) {
  const net = Number(settlement.netPayable);
  return {
    postedAt: new Date().toISOString(),
    lines: [
      { account: 'SALARY_PAYABLE', dc: 'DR', amount: Number(settlement.totalPayable) },
      { account: 'RECOVERIES', dc: 'CR', amount: Number(settlement.totalRecovery) },
      { account: net >= 0 ? 'BANK' : 'EMPLOYEE_RECOVERABLE', dc: net >= 0 ? 'CR' : 'DR', amount: Math.abs(net) },
    ],
  };
}
