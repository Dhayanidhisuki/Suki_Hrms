/**
 * Approver resolution (BRD §7.3 approverType / §7.4 position tokens).
 *
 * Resolves one matrix line (or escalation target) to concrete employees at
 * the instant of resolution. The result is materialised into WorkflowSlot
 * rows so a later reporting-line change never moves an in-flight approval.
 *
 * Tokens implemented:
 *   REQUESTER_MANAGER_L1  primary reporting manager of the requester
 *   REQUESTER_MANAGER_L2  primary reporting manager of that manager
 *   REQUESTER_DOTTED      second reporting manager of the requester
 *   SUBJECT_MANAGER_L1    primary reporting manager of the subject employee
 *   SUBJECT_MANAGER_L2    primary reporting manager of that manager
 *   APPROVER_MANAGER_L1   primary reporting manager of the (late) approver — escalation only
 *   DEPARTMENT_HEAD       holders of Role.code 'department-head' in the company
 *   PLANT_HEAD            holders of Role.code 'plant-head'
 *   BU_HEAD               holders of Role.code 'bu-head'
 *   COST_CENTRE_OWNER     no cost-centre owner field exists in Core HR yet → empty (slot Vacant)
 *
 * DEPARTMENT_HEAD / PLANT_HEAD / BU_HEAD are resolved company-wide because
 * Core HR has no department→head or plant→head mapping yet; when the roles
 * do not exist the token resolves to nobody and the slot is Vacant.
 *
 * ROLE:<code>      all active users holding that role in the company
 * EMPLOYEE:<code>  one employee by employeeCode
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ResolvedApprover } from './types';

type Db = Prisma.TransactionClient | typeof prisma;

export type ResolutionContext = {
  requesterEmpId: number;
  subjectEmpId?: number | null;
  /** The approver who breached the SLA — for APPROVER_MANAGER_L1. */
  approverEmpId?: number | null;
};

export const POSITION_TOKENS = [
  'REQUESTER_MANAGER_L1',
  'REQUESTER_MANAGER_L2',
  'REQUESTER_DOTTED',
  'SUBJECT_MANAGER_L1',
  'SUBJECT_MANAGER_L2',
  'APPROVER_MANAGER_L1',
  'DEPARTMENT_HEAD',
  'PLANT_HEAD',
  'BU_HEAD',
  'COST_CENTRE_OWNER',
] as const;
export type PositionToken = (typeof POSITION_TOKENS)[number];

const HEAD_ROLE_CODES: Record<string, string> = {
  DEPARTMENT_HEAD: 'department-head',
  PLANT_HEAD: 'plant-head',
  BU_HEAD: 'bu-head',
};

async function employeeById(db: Db, companyId: number, id: number | null | undefined) {
  if (!id) return null;
  return db.employee.findFirst({
    where: { id, companyId, deletedAt: null, isActive: true },
    select: { id: true, userId: true, reportingManagerId: true, secondReportingManagerId: true },
  });
}

async function managerOf(db: Db, companyId: number, empId: number | null | undefined): Promise<ResolvedApprover[]> {
  const emp = await employeeById(db, companyId, empId);
  const mgr = await employeeById(db, companyId, emp?.reportingManagerId);
  return mgr ? [{ empId: mgr.id, userId: mgr.userId }] : [];
}

async function managerL2Of(db: Db, companyId: number, empId: number | null | undefined): Promise<ResolvedApprover[]> {
  const emp = await employeeById(db, companyId, empId);
  const l1 = await employeeById(db, companyId, emp?.reportingManagerId);
  const l2 = await employeeById(db, companyId, l1?.reportingManagerId);
  return l2 ? [{ empId: l2.id, userId: l2.userId }] : [];
}

async function dottedOf(db: Db, companyId: number, empId: number | null | undefined): Promise<ResolvedApprover[]> {
  const emp = await employeeById(db, companyId, empId);
  const mgr = await employeeById(db, companyId, emp?.secondReportingManagerId);
  return mgr ? [{ empId: mgr.id, userId: mgr.userId }] : [];
}

/** All active users holding Role.code in this company, as approvers (employee-linked or not). */
export async function resolveRole(db: Db, companyId: number, roleCode: string): Promise<ResolvedApprover[]> {
  const users = await db.user.findMany({
    where: {
      companyId,
      isActive: true,
      deletedAt: null,
      role: { code: roleCode, companyId, isActive: true, deletedAt: null },
    },
    select: { id: true, employee: { select: { id: true, isActive: true, deletedAt: true } } },
  });
  const out: ResolvedApprover[] = [];
  for (const u of users) {
    const emp = u.employee && u.employee.isActive && !u.employee.deletedAt ? u.employee : null;
    out.push({ empId: emp?.id ?? null, userId: u.id });
  }
  return out;
}

export async function resolveEmployeeCode(db: Db, companyId: number, employeeCode: string): Promise<ResolvedApprover[]> {
  const emp = await db.employee.findFirst({
    where: { companyId, employeeCode, deletedAt: null, isActive: true },
    select: { id: true, userId: true },
  });
  return emp ? [{ empId: emp.id, userId: emp.userId }] : [];
}

export async function resolvePosition(db: Db, companyId: number, token: string, ctx: ResolutionContext): Promise<ResolvedApprover[]> {
  switch (token) {
    case 'REQUESTER_MANAGER_L1':
      return managerOf(db, companyId, ctx.requesterEmpId);
    case 'REQUESTER_MANAGER_L2':
      return managerL2Of(db, companyId, ctx.requesterEmpId);
    case 'REQUESTER_DOTTED':
      return dottedOf(db, companyId, ctx.requesterEmpId);
    case 'SUBJECT_MANAGER_L1':
      return managerOf(db, companyId, ctx.subjectEmpId ?? ctx.requesterEmpId);
    case 'SUBJECT_MANAGER_L2':
      return managerL2Of(db, companyId, ctx.subjectEmpId ?? ctx.requesterEmpId);
    case 'APPROVER_MANAGER_L1':
      return managerOf(db, companyId, ctx.approverEmpId);
    case 'DEPARTMENT_HEAD':
    case 'PLANT_HEAD':
    case 'BU_HEAD':
      return resolveRole(db, companyId, HEAD_ROLE_CODES[token]);
    case 'COST_CENTRE_OWNER':
      return []; // no cost-centre owner in Core HR yet → Vacant
    default:
      return [];
  }
}

/**
 * Resolve an approverType/approverRef pair. `ROLE:` / `EMPLOYEE:` prefixes in
 * the ref are honoured regardless of approverType, so an escalation target
 * written as POSITION `ROLE:CFO` (as in the BRD's worked matrix) works.
 * Duplicates (same empId or same userId) are removed.
 */
export async function resolveApprovers(
  db: Db,
  companyId: number,
  approverType: string,
  approverRef: string,
  ctx: ResolutionContext,
): Promise<ResolvedApprover[]> {
  const ref = (approverRef ?? '').trim();
  let list: ResolvedApprover[];
  if (ref.toUpperCase().startsWith('ROLE:')) list = await resolveRole(db, companyId, ref.slice(5).trim());
  else if (ref.toUpperCase().startsWith('EMPLOYEE:')) list = await resolveEmployeeCode(db, companyId, ref.slice(9).trim());
  else if (approverType === 'ROLE') list = await resolveRole(db, companyId, ref);
  else if (approverType === 'EMPLOYEE') list = await resolveEmployeeCode(db, companyId, ref);
  else list = await resolvePosition(db, companyId, ref.toUpperCase(), ctx);

  const seen = new Set<string>();
  const out: ResolvedApprover[] = [];
  for (const a of list) {
    if (a.empId === null && a.userId === null) continue;
    const key = a.empId !== null ? `e${a.empId}` : `u${a.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
