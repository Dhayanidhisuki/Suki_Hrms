/**
 * Approval matrix selection (BRD §7.2 / §7.5).
 *
 *   Candidates = matrices of the company + request type, status Active,
 *                effective on the submit date, every populated condition
 *                matching the request context.
 *   Score      = sum of the weights of the populated (and therefore matched)
 *                conditions: amountBand 32 | designation 16 | department 8 |
 *                grade 4 | employmentType 2 | location 1 | costCentre 1 |
 *                requestSubType 1.
 *   Selected   = highest score; tie → latest effectiveFrom; tie → lowest code.
 *   None       → the isFallback matrix; none → WF-MATRIX-404.
 *
 * selectMatrix is pure over an in-memory array; loadMatrixCandidates is the
 * thin DB loader around it.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { WorkflowError, type RequestContext } from './types';

type Db = Prisma.TransactionClient | typeof prisma;

/** The subset of WorkflowMatrix the selector needs. Amounts may be Decimal, string or number. */
export type MatrixCandidate = {
  id: number;
  code: string;
  versionNo: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isFallback: boolean;
  status: string;
  minAmount: Prisma.Decimal | string | number | null;
  maxAmount: Prisma.Decimal | string | number | null;
  designationCodes: string | null;
  departmentCodes: string | null;
  gradeCodes: string | null;
  employmentType: string | null;
  locationCode: string | null;
  costCentreCode: string | null;
  requestSubType: string | null;
};

export const SPECIFICITY_WEIGHTS = {
  amountBand: 32,
  designation: 16,
  department: 8,
  grade: 4,
  employmentType: 2,
  location: 1,
  costCentre: 1,
  requestSubType: 1,
} as const;

function toNum(v: Prisma.Decimal | string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function isBlank(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === '';
}

function listHas(list: string, value: string | null | undefined): boolean {
  if (isBlank(value)) return false;
  const wanted = value!.trim().toUpperCase();
  return list
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .includes(wanted);
}

function exact(a: string, b: string | null | undefined): boolean {
  return !isBlank(b) && a.trim().toUpperCase() === b!.trim().toUpperCase();
}

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Specificity score of one matrix against a context, or null when any
 * populated condition fails to match (i.e. it is not a candidate).
 */
export function scoreMatrix(m: MatrixCandidate, ctx: RequestContext): number | null {
  let score = 0;

  const min = toNum(m.minAmount);
  const max = toNum(m.maxAmount);
  if (min !== null || max !== null) {
    const amount = ctx.amount ?? null;
    if (amount === null) return null;
    if (min !== null && amount < min) return null; // inclusive min
    if (max !== null && amount >= max) return null; // exclusive max
    score += SPECIFICITY_WEIGHTS.amountBand;
  }
  if (!isBlank(m.designationCodes)) {
    if (!listHas(m.designationCodes!, ctx.designationCode)) return null;
    score += SPECIFICITY_WEIGHTS.designation;
  }
  if (!isBlank(m.departmentCodes)) {
    if (!listHas(m.departmentCodes!, ctx.departmentCode)) return null;
    score += SPECIFICITY_WEIGHTS.department;
  }
  if (!isBlank(m.gradeCodes)) {
    if (!listHas(m.gradeCodes!, ctx.gradeCode)) return null;
    score += SPECIFICITY_WEIGHTS.grade;
  }
  if (!isBlank(m.employmentType)) {
    if (!exact(m.employmentType!, ctx.employmentType)) return null;
    score += SPECIFICITY_WEIGHTS.employmentType;
  }
  if (!isBlank(m.locationCode)) {
    if (!exact(m.locationCode!, ctx.locationCode)) return null;
    score += SPECIFICITY_WEIGHTS.location;
  }
  if (!isBlank(m.costCentreCode)) {
    if (!exact(m.costCentreCode!, ctx.costCentreCode)) return null;
    score += SPECIFICITY_WEIGHTS.costCentre;
  }
  if (!isBlank(m.requestSubType)) {
    if (!exact(m.requestSubType!, ctx.requestSubType)) return null;
    score += SPECIFICITY_WEIGHTS.requestSubType;
  }
  return score;
}

export function isEffectiveOn(m: MatrixCandidate, at: Date): boolean {
  const day = utcDay(at);
  if (utcDay(m.effectiveFrom) > day) return false;
  if (m.effectiveTo && utcDay(m.effectiveTo) < day) return false;
  return true;
}

export type MatrixSelection<M extends MatrixCandidate = MatrixCandidate> = { matrix: M; score: number; viaFallback: boolean };

/**
 * Pure §7.5 selection over `matrices` (already restricted to the company and
 * request type). Throws WorkflowError WF-MATRIX-404 when nothing applies.
 */
export function selectMatrix<M extends MatrixCandidate>(matrices: readonly M[], ctx: RequestContext, at: Date): MatrixSelection<M> {
  const live = matrices.filter((m) => m.status === 'Active' && isEffectiveOn(m, at));

  let best: MatrixSelection<M> | null = null;
  for (const m of live) {
    if (m.isFallback) continue; // the fallback matches everything by definition; considered last
    const score = scoreMatrix(m, ctx);
    if (score === null) continue;
    if (!best) {
      best = { matrix: m, score, viaFallback: false };
      continue;
    }
    if (score > best.score) best = { matrix: m, score, viaFallback: false };
    else if (score === best.score) {
      const a = utcDay(m.effectiveFrom);
      const b = utcDay(best.matrix.effectiveFrom);
      if (a > b || (a === b && m.code.localeCompare(best.matrix.code) < 0)) best = { matrix: m, score, viaFallback: false };
    }
  }
  if (best) return best;

  const fallbacks = live.filter((m) => m.isFallback).sort((x, y) => {
    const d = utcDay(y.effectiveFrom) - utcDay(x.effectiveFrom);
    return d !== 0 ? d : x.code.localeCompare(y.code);
  });
  if (fallbacks.length > 0) return { matrix: fallbacks[0], score: 0, viaFallback: true };

  throw new WorkflowError('WF-MATRIX-404', 'No approval matrix applies to this request and no fallback matrix is configured', 422);
}

/** Thin DB loader: all Active matrices of the company + request type (any version), for selectMatrix. */
export async function loadMatrixCandidates(db: Db, companyId: number, requestTypeCode: string) {
  return db.workflowMatrix.findMany({
    where: { companyId, requestTypeCode, status: 'Active' },
    orderBy: [{ code: 'asc' }, { versionNo: 'desc' }],
  });
}

export async function loadMatrixLines(db: Db, matrixId: number) {
  return db.workflowMatrixLine.findMany({
    where: { matrixId },
    orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }],
  });
}
