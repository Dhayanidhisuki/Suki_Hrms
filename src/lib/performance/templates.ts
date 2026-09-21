/**
 * Shared resolution of submitted KRA/KPI lines against the masters.
 *
 * Both the template builder and goal assignment take the same
 * "KRA → KPIs" payload shape, and both must confirm, before saving, that:
 *   - every KRA and KPI id belongs to the caller's own company (the FKs are
 *     cross-tenant on their own);
 *   - every KPI sits under the KRA it was submitted against — otherwise Model
 *     A's "100% within each KRA" rule is meaningless;
 *   - no KRA or KPI is listed twice.
 *
 * It also returns the master rows, so callers can snapshot unit/measurement
 * type onto an assigned goal, and a label map for weightage error messages.
 */

import { prisma } from '@/lib/prisma';
import type { WeightageKra } from './weightage';
import { findIneffectiveKras } from './weightage';

type SubmittedLine = {
  kraId: number;
  weightage: number;
  kpis: Array<{ kpiId: number; weightage: number }>;
};

export type ResolvedMasters = {
  forValidation: WeightageKra[];
  kraById: Map<number, { id: number; code: string; name: string }>;
  kpiById: Map<
    number,
    {
      id: number;
      kraId: number;
      code: string;
      name: string;
      unit: string;
      measurementType: string;
      target: unknown;
      minThreshold: unknown;
      maxTarget: unknown;
      frequency: string;
      description: string;
    }
  >;
};

export function snapshotTemplateKpis(
  lines: Array<{ kraId: number; weightage: number; kpis: Array<{ kpiId: number; target: number; weightage: number; minThreshold?: number | null; maxTarget?: number | null }> }>,
  kpiById: ResolvedMasters['kpiById']
) {
  return lines.map((k) => ({
    kraId: k.kraId,
    weightage: k.weightage,
    kpis: {
      create: k.kpis.map((p) => {
        const master = kpiById.get(p.kpiId)!;
        return {
          kpiId: p.kpiId,
          description: master.description,
          measurementType: master.measurementType,
          unit: master.unit,
          target: p.target,
          minThreshold: nullableNumber(p.minThreshold ?? master.minThreshold),
          maxTarget: nullableNumber(p.maxTarget ?? master.maxTarget),
          weightage: p.weightage,
          frequency: master.frequency,
        };
      }),
    },
  }));
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function resolveTemplateLines(
  companyId: number,
  lines: SubmittedLine[],
  /**
   * Date the KRAs are being used *for* — today when saving a template, the
   * cycle start when assigning goals. Omit to skip the check (callers with no
   * meaningful date should not silently pick one).
   */
  asOf?: Date
): Promise<ResolvedMasters | { error: string; status: number }> {
  const kraIds = lines.map((l) => l.kraId);
  if (new Set(kraIds).size !== kraIds.length) {
    return { error: 'The same KRA is listed more than once', status: 400 };
  }

  const kpiIds = lines.flatMap((l) => l.kpis.map((k) => k.kpiId));
  if (new Set(kpiIds).size !== kpiIds.length) {
    return { error: 'The same KPI is listed more than once', status: 400 };
  }

  const kras = await prisma.kra.findMany({
    where: { id: { in: kraIds }, companyId },
    select: { id: true, code: true, name: true, effectiveFrom: true, effectiveTo: true },
  });
  if (kras.length !== kraIds.length) {
    return { error: 'One or more KRAs were not found', status: 404 };
  }

  // BRD §8 effective dating. Without this the dates were decoration: a KRA
  // whose window closed could still be built into a template and assigned.
  if (asOf) {
    const expired = findIneffectiveKras(kras, asOf);
    if (expired.length) {
      return {
        error: `Not effective on ${asOf.toISOString().slice(0, 10)}: ${expired.join(', ')}`,
        status: 400,
      };
    }
  }

  const kpis = await prisma.kpi.findMany({
    where: { id: { in: kpiIds }, companyId },
    select: {
      id: true,
      kraId: true,
      code: true,
      name: true,
      unit: true,
      measurementType: true,
      target: true,
      minThreshold: true,
      maxTarget: true,
      frequency: true,
      description: true,
    },
  });
  if (kpis.length !== kpiIds.length) {
    return { error: 'One or more KPIs were not found', status: 404 };
  }

  const kraById = new Map(kras.map((k) => [k.id, k]));
  const kpiById = new Map(kpis.map((k) => [k.id, k]));

  for (const line of lines) {
    for (const kpi of line.kpis) {
      const master = kpiById.get(kpi.kpiId)!;
      if (master.kraId !== line.kraId) {
        const kra = kraById.get(line.kraId)!;
        return { error: `KPI "${master.code}" does not belong to KRA "${kra.code}"`, status: 400 };
      }
    }
  }

  const forValidation: WeightageKra[] = lines.map((line) => ({
    label: kraById.get(line.kraId)!.code,
    weightage: line.weightage,
    kpis: line.kpis.map((k) => ({ label: kpiById.get(k.kpiId)!.code, weightage: k.weightage })),
  }));

  return { forValidation, kraById, kpiById };
}
