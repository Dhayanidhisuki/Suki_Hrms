/**
 * Copy a GoalTemplate's snapshotted KRA/KPI lines onto an EmployeeGoalSet.
 *
 * The assigned set is self-contained: later edits to the template or the
 * KPI master must not rewrite goals that have already been given to someone.
 * KPI dates default to the full cycle window (BRD §41).
 */

import type { Prisma } from '@prisma/client';

export const TEMPLATE_FULL_INCLUDE = {
  kras: {
    include: {
      kra: { select: { id: true, code: true, name: true, category: true } },
      kpis: {
        include: { kpi: { select: { id: true, code: true, name: true } } },
        orderBy: { id: 'asc' as const },
      },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.GoalTemplateInclude;

type TemplateForCopy = {
  id: number;
  kras: Array<{
    kraId: number;
    weightage: unknown;
    kpis: Array<{
      kpiId: number;
      description: string;
      measurementType: string;
      unit: string;
      target: unknown;
      minThreshold: unknown;
      maxTarget: unknown;
      weightage: unknown;
      frequency: string;
      kpi: {
        description?: string;
        measurementType?: string;
        unit?: string;
        minThreshold?: unknown;
        maxTarget?: unknown;
        frequency?: string;
      };
    }>;
  }>;
};

export function goalSetCreateFromTemplate(
  template: TemplateForCopy,
  cycle: { startDate: Date; endDate: Date }
) {
  return template.kras.map((tk) => ({
    kraId: tk.kraId,
    weightage: Number(tk.weightage),
    kpis: {
      create: tk.kpis.map((tp) => ({
        kpiId: tp.kpiId,
        description: tp.description || tp.kpi.description || '',
        measurementType: tp.measurementType || tp.kpi.measurementType || 'HIGHER_IS_BETTER',
        unit: tp.unit || tp.kpi.unit || '',
        target: Number(tp.target),
        minThreshold: tp.minThreshold != null ? Number(tp.minThreshold) : tp.kpi.minThreshold != null ? Number(tp.kpi.minThreshold) : null,
        maxTarget: tp.maxTarget != null ? Number(tp.maxTarget) : tp.kpi.maxTarget != null ? Number(tp.kpi.maxTarget) : null,
        weightage: Number(tp.weightage),
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        frequency: tp.frequency || tp.kpi.frequency || 'ANNUAL',
      })),
    },
  }));
}

/** PENDING_ACCEPTANCE / ACCEPTED / COMPLETED lock in-place template edits. */
export const TEMPLATE_LOCK_STATUSES = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'COMPLETED'] as const;

/**
 * Statuses an assignment can be re-issued over.
 *
 * RETURNED is the employee asking for a revision, and DRAFT was never issued —
 * both should accept a fresh snapshot from the template. PENDING_ACCEPTANCE is
 * already with the employee, and ACCEPTED / COMPLETED are commitments that must
 * not be silently rewritten.
 */
export const REISSUABLE_STATUSES = ['DRAFT', 'RETURNED'] as const;

export function canReissueAssignment(status: string): boolean {
  return (REISSUABLE_STATUSES as readonly string[]).includes(status);
}
