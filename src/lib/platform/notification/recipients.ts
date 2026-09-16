/**
 * Recipient expression resolution (BRD §13.2, §13.4).
 *
 * Implemented classes:
 *   REQUESTER, SUBJECT_EMPLOYEE, REQUESTER_MANAGER_L1, REQUESTER_MANAGER_L2,
 *   SUBJECT_MANAGER_L1, CURRENT_APPROVERS, PREVIOUS_APPROVERS,
 *   ROLE:<Role.code>, EMPLOYEE:<employeeCode>, USER:<userId>, EXTERNAL:<email>
 *
 * Not implemented (no backing data in this schema): POSITION:, DISTRIBUTION_LIST:,
 * CANDIDATE, DOCUMENT_OWNER, HR_DOCUMENT_CONTROLLER — logged and skipped.
 *
 * Address precedence (§13.4): official email (JobInfo) → login email (User) →
 * personal email only when allowPersonalEmail (STATUTORY category or separated
 * employee). Mobile: present → permanent.
 */

import { prisma } from '@/lib/prisma';
import type { PlatformEventContext } from '../contracts';

export type EmployeeInfo = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  designation: string | null;
  designationCode: string | null;
  department: string | null;
  departmentCode: string | null;
  plant: string | null;
  email: string | null;
  mobile: string | null;
  userId: number | null;
  status: string;
  reportingManagerId: number | null;
};

export type ResolvedRecipient = {
  type: 'EMPLOYEE' | 'USER' | 'EXTERNAL';
  /** identity key used for de-duplication */
  key: string;
  employeeId: number | null;
  userId: number | null;
  email: string | null;
  mobile: string | null;
  /** the expression that produced this recipient (first one wins) */
  expression: string;
  info: EmployeeInfo | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loadEmployeeInfo(
  companyId: number,
  ids: number[],
  opts: { allowPersonalEmail?: boolean } = {},
): Promise<Map<number, EmployeeInfo>> {
  const out = new Map<number, EmployeeInfo>();
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (unique.length === 0) return out;
  const rows = await prisma.employee.findMany({
    where: { id: { in: unique }, companyId, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      status: true,
      userId: true,
      reportingManagerId: true,
      user: { select: { email: true, isActive: true } },
      contactDetails: { select: { presentMobile: true, permanentMobile: true } },
      personalDetails: { select: { personalEmail: true } },
      jobInfos: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: {
          officialEmail: true,
          department: { select: { code: true, name: true } },
          designation: { select: { code: true, name: true } },
          unit: { select: { code: true, name: true } },
        },
      },
    },
  });
  for (const r of rows) {
    const job = r.jobInfos[0];
    const separated = !['active', 'on-leave'].includes((r.status ?? '').toLowerCase());
    const personal = opts.allowPersonalEmail || separated ? r.personalDetails?.personalEmail ?? null : null;
    const email = firstValid(job?.officialEmail, r.user?.email, personal);
    out.set(r.id, {
      id: r.id,
      code: r.employeeCode,
      firstName: r.firstName,
      lastName: r.lastName,
      fullName: [r.firstName, r.lastName].filter(Boolean).join(' '),
      designation: job?.designation?.name ?? null,
      designationCode: job?.designation?.code ?? null,
      department: job?.department?.name ?? null,
      departmentCode: job?.department?.code ?? null,
      plant: job?.unit?.name ?? null,
      email,
      mobile: firstNonEmpty(r.contactDetails?.presentMobile, r.contactDetails?.permanentMobile),
      userId: r.userId ?? null,
      status: r.status,
      reportingManagerId: r.reportingManagerId ?? null,
    });
  }
  return out;
}

function firstValid(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    const s = v?.trim();
    if (s && EMAIL_RE.test(s)) return s;
  }
  return null;
}

function firstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    const s = v?.trim();
    if (s) return s;
  }
  return null;
}

/** Placeholder namespace for an employee (Employee / Requester / Recipient). */
export function employeeNamespace(info: EmployeeInfo | null | undefined): Record<string, unknown> {
  if (!info) return {};
  return {
    Id: info.id,
    Code: info.code,
    FirstName: info.firstName,
    LastName: info.lastName,
    FullName: info.fullName,
    Name: info.fullName,
    Designation: info.designation,
    Department: info.department,
    Plant: info.plant,
    Email: info.email,
    Mobile: info.mobile,
    Status: info.status,
  };
}

type Seed = { expression: string; employeeId?: number; userId?: number; email?: string };

export async function resolveRecipients(
  companyId: number,
  expressions: string[],
  ctx: PlatformEventContext,
  opts: { allowPersonalEmail?: boolean } = {},
): Promise<ResolvedRecipient[]> {
  const exprs = [...new Set(expressions.map((e) => e.trim()).filter(Boolean))];
  if (exprs.length === 0) return [];

  // Request-derived ids: prefer ctx, fall back to the WorkflowRequest row.
  let requesterEmpId = ctx.requesterEmpId ?? null;
  let subjectEmpId = ctx.subjectEmpId ?? null;
  const needsRequest =
    ctx.requestId &&
    exprs.some((e) => ['REQUESTER', 'SUBJECT_EMPLOYEE', 'REQUESTER_MANAGER_L1', 'REQUESTER_MANAGER_L2', 'SUBJECT_MANAGER_L1', 'CURRENT_APPROVERS', 'PREVIOUS_APPROVERS'].includes(e));
  if (needsRequest && (requesterEmpId === null || subjectEmpId === null)) {
    const req = await prisma.workflowRequest.findFirst({
      where: { id: ctx.requestId!, companyId },
      select: { requesterEmpId: true, subjectEmpId: true },
    });
    if (req) {
      requesterEmpId ??= req.requesterEmpId;
      subjectEmpId ??= req.subjectEmpId ?? req.requesterEmpId;
    }
  }
  if (subjectEmpId === null) subjectEmpId = requesterEmpId;
  if (requesterEmpId === null) requesterEmpId = subjectEmpId;

  const seeds: Seed[] = [];
  const push = (expression: string, s: Omit<Seed, 'expression'>) => seeds.push({ expression, ...s });

  // Managers need a lookup of the base employee first.
  const managerBase = new Map<number, EmployeeInfo>();
  const baseIds = [requesterEmpId, subjectEmpId].filter((n): n is number => n !== null);
  if (baseIds.length && exprs.some((e) => e.endsWith('_MANAGER_L1') || e.endsWith('_MANAGER_L2'))) {
    for (const [k, v] of await loadEmployeeInfo(companyId, baseIds, opts)) managerBase.set(k, v);
  }

  for (const expr of exprs) {
    const upper = expr.toUpperCase();
    if (upper === 'REQUESTER') {
      if (requesterEmpId) push(expr, { employeeId: requesterEmpId });
    } else if (upper === 'SUBJECT_EMPLOYEE') {
      if (subjectEmpId) push(expr, { employeeId: subjectEmpId });
    } else if (upper === 'REQUESTER_MANAGER_L1' || upper === 'SUBJECT_MANAGER_L1') {
      const base = upper.startsWith('REQUESTER') ? requesterEmpId : subjectEmpId;
      const mgr = base ? managerBase.get(base)?.reportingManagerId : null;
      if (mgr) push(expr, { employeeId: mgr });
    } else if (upper === 'REQUESTER_MANAGER_L2') {
      const l1 = requesterEmpId ? managerBase.get(requesterEmpId)?.reportingManagerId : null;
      if (l1) {
        const l1Info = (await loadEmployeeInfo(companyId, [l1], opts)).get(l1);
        if (l1Info?.reportingManagerId) push(expr, { employeeId: l1Info.reportingManagerId });
      }
    } else if (upper === 'CURRENT_APPROVERS' || upper === 'PREVIOUS_APPROVERS') {
      if (ctx.requestId) {
        const slots = await prisma.workflowSlot.findMany({
          where: {
            requestId: ctx.requestId,
            status: upper === 'CURRENT_APPROVERS' ? 'Pending' : { in: ['Approved', 'Rejected', 'Returned'] },
          },
          select: { resolvedEmpId: true, resolvedUserId: true, actedByEmpId: true, actedByUserId: true },
        });
        for (const s of slots) {
          const empId = upper === 'CURRENT_APPROVERS' ? s.resolvedEmpId : s.actedByEmpId ?? s.resolvedEmpId;
          const userId = upper === 'CURRENT_APPROVERS' ? s.resolvedUserId : s.actedByUserId ?? s.resolvedUserId;
          if (empId) push(expr, { employeeId: empId });
          else if (userId) push(expr, { userId });
        }
      }
    } else if (upper.startsWith('ROLE:')) {
      const code = expr.slice(5).trim();
      if (code) {
        const users = await prisma.user.findMany({
          where: { companyId, isActive: true, deletedAt: null, role: { code, deletedAt: null } },
          select: { id: true, employee: { select: { id: true, deletedAt: true } } },
        });
        for (const u of users) {
          if (u.employee && !u.employee.deletedAt) push(expr, { employeeId: u.employee.id });
          else push(expr, { userId: u.id });
        }
      }
    } else if (upper.startsWith('EMPLOYEE:')) {
      const code = expr.slice(9).trim();
      if (code) {
        const emp = await prisma.employee.findFirst({ where: { companyId, employeeCode: code, deletedAt: null }, select: { id: true } });
        if (emp) push(expr, { employeeId: emp.id });
      }
    } else if (upper.startsWith('USER:')) {
      const id = Number(expr.slice(5).trim());
      if (Number.isInteger(id) && id > 0) push(expr, { userId: id });
    } else if (upper.startsWith('EXTERNAL:')) {
      const email = expr.slice(9).trim();
      if (EMAIL_RE.test(email)) push(expr, { email });
    } else {
      console.warn(`[notification] recipient expression not supported: ${expr}`);
    }
  }

  // USER:<id> may map to an employee; resolve that first so the identity de-dupes.
  const userIds = [...new Set(seeds.filter((s) => s.userId).map((s) => s.userId!))];
  const userRows = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true, deletedAt: null, OR: [{ companyId }, { isSuperAdmin: true }] },
        select: { id: true, email: true, employee: { select: { id: true, deletedAt: true, companyId: true } } },
      })
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));
  for (const s of seeds) {
    if (s.userId && !s.employeeId) {
      const u = userById.get(s.userId);
      if (u?.employee && !u.employee.deletedAt && u.employee.companyId === companyId) s.employeeId = u.employee.id;
    }
  }

  const empIds = seeds.filter((s) => s.employeeId).map((s) => s.employeeId!);
  const info = await loadEmployeeInfo(companyId, empIds, opts);

  const out = new Map<string, ResolvedRecipient>();
  for (const s of seeds) {
    let r: ResolvedRecipient | null = null;
    if (s.employeeId) {
      const i = info.get(s.employeeId);
      if (!i) continue; // not in this company / deleted
      r = { type: 'EMPLOYEE', key: `EMP:${i.id}`, employeeId: i.id, userId: i.userId, email: i.email, mobile: i.mobile, expression: s.expression, info: i };
    } else if (s.userId) {
      const u = userById.get(s.userId);
      if (!u) continue;
      r = { type: 'USER', key: `USER:${u.id}`, employeeId: null, userId: u.id, email: firstValid(u.email), mobile: null, expression: s.expression, info: null };
    } else if (s.email) {
      const e = s.email.toLowerCase();
      r = { type: 'EXTERNAL', key: `EXT:${e}`, employeeId: null, userId: null, email: s.email, mobile: null, expression: s.expression, info: null };
    }
    if (r && !out.has(r.key)) out.set(r.key, r);
  }
  return [...out.values()];
}
