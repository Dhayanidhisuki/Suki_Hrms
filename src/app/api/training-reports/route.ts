/**
 * GET /api/training-reports?type=<report>&from=&to=&departmentId=
 *   — consolidated training reports (BRD §41). Each type returns
 *   { columns: string[], rows: (string|number|null)[][] } so the page can
 *   render a generic table and export to CSV.
 *
 *   Types: schedule-list | employee-history | department-wise | hours |
 *          cost | budget | effectiveness | certification |
 *          assessment-results | attendance | planned-vs-actual
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

type Cell = string | number | null;

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const sp = new URL(request.url).searchParams;
  const type = sp.get('type') ?? 'schedule-list';
  const from = sp.get('from') ? new Date(sp.get('from')!) : null;
  const to = sp.get('to') ? new Date(sp.get('to')! + 'T23:59:59') : null;
  const departmentId = sp.get('departmentId') ? parseInt(sp.get('departmentId')!) : null;

  const dateRange = (field = 'scheduledDate') =>
    from || to ? { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

  let columns: string[] = [];
  let rows: Cell[][] = [];

  switch (type) {
    case 'schedule-list': {
      const data = await prisma.trainingSchedule.findMany({
        where: { companyId, deletedAt: null, ...dateRange() },
        include: { trainingProgram: { select: { name: true } }, nominations: { where: { deletedAt: null }, select: { id: true } }, attendances: { where: { deletedAt: null, status: { in: ['PRESENT', 'LATE'] } }, select: { id: true } } },
        orderBy: { scheduledDate: 'asc' },
      });
      columns = ['ID', 'Program', 'Title', 'Date', 'Time', 'Method', 'Nominees', 'Attended', 'Status'];
      rows = data.map((s) => [s.id, s.trainingProgram?.name ?? '', s.title, s.scheduledDate?.toISOString().slice(0, 10) ?? null, s.startTime, s.method, s.nominations.length, s.attendances.length, s.status]);
      break;
    }

    case 'employee-history': {
      const data = await prisma.trainingHistory.findMany({
        where: { companyId, deletedAt: null, ...(from || to ? { scheduledDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
        orderBy: { scheduledDate: 'desc' },
      });
      const emps = await prisma.employee.findMany({ where: { id: { in: data.map((d) => d.employeeId) } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } });
      const empMap = new Map(emps.map((e) => [e.id, e]));
      columns = ['Employee Code', 'Employee', 'Program', 'Date', 'Method', 'Attendance %', 'Result'];
      rows = data.map((h) => {
        const e = empMap.get(h.employeeId);
        return [e?.employeeCode ?? '', e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : `#${h.employeeId}`, h.programName, h.scheduledDate?.toISOString().slice(0, 10) ?? null, h.method, h.attendancePercent != null ? Number(h.attendancePercent) : null, h.result];
      });
      break;
    }

    case 'department-wise': {
      const noms = await prisma.trainingNomination.findMany({
        where: { companyId, deletedAt: null, ...(departmentId ? {} : {}) },
        select: { employeeId: true, status: true },
      });
      const emps = await prisma.employee.findMany({
        where: { id: { in: Array.from(new Set(noms.map((n) => n.employeeId))) } },
        select: { id: true, jobInfos: { where: { effectiveTo: null }, take: 1, select: { departmentId: true, department: { select: { name: true } } } } },
      });
      const deptOf = new Map(emps.map((e) => [e.id, e.jobInfos[0]?.department?.name ?? 'Unassigned']));
      const byDept = new Map<string, { total: number; approved: number }>();
      for (const n of noms) {
        const dept = deptOf.get(n.employeeId) ?? 'Unassigned';
        if (departmentId && emps.find((e) => e.id === n.employeeId)?.jobInfos[0]?.departmentId !== departmentId) continue;
        const cur = byDept.get(dept) ?? { total: 0, approved: 0 };
        cur.total++;
        if (n.status === 'APPROVED') cur.approved++;
        byDept.set(dept, cur);
      }
      columns = ['Department', 'Nominations', 'Approved', 'Approval %'];
      rows = [...byDept.entries()].map(([d, v]) => [d, v.total, v.approved, v.total ? Math.round((v.approved / v.total) * 100) : 0]);
      break;
    }

    case 'hours': {
      const data = await prisma.trainingSchedule.findMany({
        where: { companyId, deletedAt: null, status: 'COMPLETED', ...dateRange() },
        select: { scheduledDate: true, duration: true, attendances: { where: { deletedAt: null, status: { in: ['PRESENT', 'LATE'] } }, select: { id: true } } },
      });
      const byMonth = new Map<string, { sessions: number; hours: number; attendees: number }>();
      for (const s of data) {
        const key = s.scheduledDate?.toISOString().slice(0, 7) ?? 'unknown';
        const cur = byMonth.get(key) ?? { sessions: 0, hours: 0, attendees: 0 };
        cur.sessions++; cur.hours += Number(s.duration ?? 0); cur.attendees += s.attendances.length;
        byMonth.set(key, cur);
      }
      columns = ['Month', 'Sessions', 'Training Hours', 'Attendees', 'Person-Hours'];
      rows = [...byMonth.entries()].sort().map(([m, v]) => [m, v.sessions, v.hours, v.attendees, Math.round(v.hours * v.attendees * 100) / 100]);
      break;
    }

    case 'cost': {
      const data = await prisma.trainingSchedule.findMany({
        where: { companyId, deletedAt: null, status: 'COMPLETED', ...dateRange() },
        include: { trainingProgram: { select: { name: true, estimatedCost: true } } },
      });
      columns = ['Schedule', 'Program', 'Date', 'Estimated Cost'];
      rows = data.map((s) => [s.id, s.trainingProgram?.name ?? s.title, s.scheduledDate?.toISOString().slice(0, 10) ?? null, s.trainingProgram?.estimatedCost != null ? Number(s.trainingProgram.estimatedCost) : null]);
      rows.push(['', 'TOTAL', '', data.reduce((sum, s) => sum + Number(s.trainingProgram?.estimatedCost ?? 0), 0)]);
      break;
    }

    case 'budget': {
      const year = sp.get('year') ?? String(new Date().getFullYear());
      const data = await prisma.trainingBudget.findMany({ where: { companyId, deletedAt: null, year } });
      const depts = await prisma.department.findMany({ where: { id: { in: data.map((d) => d.departmentId).filter((x): x is number => x != null) } }, select: { id: true, name: true } });
      const dMap = new Map(depts.map((d) => [d.id, d.name]));
      columns = ['Year', 'Department', 'Allocated', 'Approved', 'Utilized', 'Balance', 'Utilization %'];
      rows = data.map((b) => {
        const base = Number(b.approvedAmount ?? b.allocatedAmount);
        const used = Number(b.utilizedAmount);
        return [b.year, b.departmentId ? dMap.get(b.departmentId) ?? `#${b.departmentId}` : 'Company-wide', Number(b.allocatedAmount), b.approvedAmount != null ? Number(b.approvedAmount) : null, used, base - used, base > 0 ? Math.round((used / base) * 100) : 0];
      });
      break;
    }

    case 'effectiveness': {
      const data = await prisma.trainingEffectiveness.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      columns = ['ID', 'Employee', 'Schedule', 'Stage', 'Pre', 'Post', 'Improvement', 'Rating', 'Evaluated'];
      rows = data.map((e) => [e.id, e.employeeId, e.trainingScheduleId, e.evaluationStage, e.preScore, e.postScore, e.scoreImprovement, e.effectivenessRating, e.evaluationDate?.toISOString().slice(0, 10) ?? null]);
      break;
    }

    case 'certification': {
      const data = await prisma.trainingCertificate.findMany({ where: { companyId, deletedAt: null }, orderBy: { issueDate: 'desc' } });
      const emps = await prisma.employee.findMany({ where: { id: { in: data.map((d) => d.employeeId) } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } });
      const empMap = new Map(emps.map((e) => [e.id, e]));
      const today = new Date().toISOString().slice(0, 10);
      columns = ['Certificate #', 'Employee', 'Issued', 'Expires', 'Status'];
      rows = data.map((c) => {
        const e = empMap.get(c.employeeId);
        return [c.certificateNumber, e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : `#${c.employeeId}`, c.issueDate?.toISOString().slice(0, 10) ?? null, c.expiryDate?.toISOString().slice(0, 10) ?? null, c.expiryDate && c.expiryDate.toISOString().slice(0, 10) < today ? 'EXPIRED' : 'VALID'];
      });
      break;
    }

    case 'assessment-results': {
      const data = await prisma.assessmentAttempt.findMany({
        where: { companyId, deletedAt: null, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
      });
      const assessments = await prisma.assessment.findMany({ where: { id: { in: data.map((d) => d.assessmentId) } }, select: { id: true, title: true, assessmentType: true } });
      const aMap = new Map(assessments.map((a) => [a.id, a]));
      columns = ['Assessment', 'Type', 'Employee', 'Attempt', 'Score', 'Result', 'Time (s)', 'Submitted'];
      rows = data.map((a) => {
        const asmt = aMap.get(a.assessmentId);
        return [asmt?.title ?? `#${a.assessmentId}`, asmt?.assessmentType ?? '', a.employeeId, a.attemptNumber, a.scorePercent, a.result, a.timeTakenSeconds, a.submittedAt?.toISOString().slice(0, 10) ?? null];
      });
      break;
    }

    case 'attendance': {
      const data = await prisma.trainingAttendance.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      const scheds = await prisma.trainingSchedule.findMany({ where: { id: { in: data.map((d) => d.trainingScheduleId) } }, select: { id: true, title: true, scheduledDate: true } });
      const sMap = new Map(scheds.map((s) => [s.id, s]));
      columns = ['Schedule', 'Date', 'Employee', 'Status', 'Attendance %'];
      rows = data.map((a) => {
        const s = sMap.get(a.trainingScheduleId);
        return [s?.title ?? `#${a.trainingScheduleId}`, s?.scheduledDate?.toISOString().slice(0, 10) ?? null, a.employeeId, a.status, a.attendancePercent != null ? Number(a.attendancePercent) : null];
      });
      break;
    }

    case 'planned-vs-actual': {
      const year = sp.get('year') ?? String(new Date().getFullYear());
      const plans = await prisma.trainingPlan.findMany({
        where: { companyId, deletedAt: null, year },
        include: { lines: { where: { deletedAt: null }, include: { trainingProgram: { select: { name: true } } } } },
      });
      const completed = await prisma.trainingSchedule.findMany({
        where: { companyId, deletedAt: null, status: 'COMPLETED', scheduledDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
        select: { trainingProgramId: true },
      });
      const doneByProgram = new Map<number, number>();
      for (const c of completed) doneByProgram.set(c.trainingProgramId, (doneByProgram.get(c.trainingProgramId) ?? 0) + 1);
      columns = ['Plan', 'Month', 'Program', 'Planned Sessions', 'Completed Sessions', 'Status'];
      for (const p of plans) {
        for (const l of p.lines) {
          rows.push([p.title ?? `Plan ${p.id}`, l.plannedMonth, l.trainingProgram?.name ?? `#${l.trainingProgramId}`, 1, doneByProgram.get(l.trainingProgramId) ?? 0, l.status]);
        }
      }
      break;
    }

    // ── Phase 14 additions ────────────────────────────────────────────────────

    case 'trainer-performance': {
      // Sessions delivered + attendees + avg trainer rating from feedback.
      const trainers = await prisma.trainer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true, isExternal: true } });
      const schedules = await prisma.trainingSchedule.findMany({
        where: { companyId, deletedAt: null, trainerId: { in: trainers.map((t) => t.id) }, ...dateRange() },
        select: { trainerId: true, status: true, attendances: { where: { deletedAt: null, status: { in: ['PRESENT', 'LATE'] } }, select: { id: true } }, feedbacks: { where: { deletedAt: null }, select: { trainerRating: true } } },
      });
      columns = ['Trainer', 'Type', 'Sessions', 'Completed', 'Attendees', 'Avg Rating'];
      rows = trainers.map((t) => {
        const mine = schedules.filter((s) => s.trainerId === t.id);
        const ratings = mine.flatMap((s) => s.feedbacks.map((f) => f.trainerRating).filter((x): x is number => x != null));
        const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
        return [t.name, t.isExternal ? 'External' : 'Internal', mine.length, mine.filter((s) => s.status === 'COMPLETED').length, mine.reduce((sum, s) => sum + s.attendances.length, 0), avg];
      });
      break;
    }

    case 'roi': {
      // Cost vs measured improvement per program.
      const programs = await prisma.trainingProgram.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true, estimatedCost: true } });
      const schedIds = await prisma.trainingSchedule.findMany({ where: { companyId, deletedAt: null, status: 'COMPLETED', ...dateRange() }, select: { id: true, trainingProgramId: true } });
      const effectiveness = await prisma.trainingEffectiveness.findMany({
        where: { companyId, deletedAt: null, scoreImprovement: { not: null } },
        select: { scoreImprovement: true, trainingScheduleId: true },
      });
      const progOfSched = new Map(schedIds.map((s) => [s.id, s.trainingProgramId]));
      const impByProgram = new Map<number, { sum: number; n: number }>();
      for (const e of effectiveness) {
        const pid = progOfSched.get(e.trainingScheduleId);
        if (pid == null) continue;
        const cur = impByProgram.get(pid) ?? { sum: 0, n: 0 };
        cur.sum += e.scoreImprovement ?? 0; cur.n++;
        impByProgram.set(pid, cur);
      }
      columns = ['Program', 'Sessions Completed', 'Est. Cost', 'Avg Improvement (pts)', 'Improvement per ₹1k'];
      rows = programs.map((p) => {
        const sessions = schedIds.filter((s) => s.trainingProgramId === p.id).length;
        const cost = Number(p.estimatedCost ?? 0);
        const imp = impByProgram.get(p.id);
        const avgImp = imp && imp.n ? Math.round((imp.sum / imp.n) * 10) / 10 : null;
        const perThousand = avgImp != null && cost > 0 ? Math.round((avgImp / cost) * 1000 * 100) / 100 : null;
        return [p.name, sessions, cost, avgImp, perThousand];
      });
      break;
    }

    case 'tna': {
      const data = await prisma.trainingNeedRequest.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      const emps = await prisma.employee.findMany({ where: { id: { in: data.map((d) => d.employeeId) } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } });
      const comps = await prisma.competency.findMany({ where: { id: { in: data.map((d) => d.competencyId).filter((x): x is number => x != null) } }, select: { id: true, name: true } });
      const empMap = new Map(emps.map((e) => [e.id, e]));
      const compMap = new Map(comps.map((c) => [c.id, c.name]));
      columns = ['ID', 'Employee', 'Competency', 'Source', 'Priority', 'Status', 'Stage', 'Created'];
      rows = data.map((t) => {
        const e = empMap.get(t.employeeId);
        return [t.id, e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : `#${t.employeeId}`, t.competencyId ? compMap.get(t.competencyId) ?? `#${t.competencyId}` : '—', t.source, t.priority, t.status, t.currentStageOrder, t.createdAt?.toISOString().slice(0, 10) ?? null];
      });
      break;
    }

    case 'pending':
    case 'overdue':
    case 'upcoming': {
      const today = new Date().toISOString().slice(0, 10);
      const noms = await prisma.trainingNomination.findMany({
        where: { companyId, deletedAt: null },
        include: { trainingSchedule: { select: { id: true, title: true, scheduledDate: true, status: true, trainingProgram: { select: { name: true } } } } },
      });
      const emps = await prisma.employee.findMany({ where: { id: { in: noms.map((n) => n.employeeId) } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } });
      const empMap = new Map(emps.map((e) => [e.id, e]));
      columns = ['Employee', 'Program', 'Schedule', 'Date', 'Nomination Status', 'Schedule Status'];
      const filtered = noms.filter((n) => {
        const d = n.trainingSchedule?.scheduledDate?.toISOString().slice(0, 10) ?? '';
        const done = n.trainingSchedule?.status === 'COMPLETED';
        if (type === 'pending') return !done && n.status !== 'REJECTED' && n.status !== 'CANCELLED';
        if (type === 'overdue') return !done && d !== '' && d < today;
        return !done && d >= today; // upcoming
      });
      rows = filtered.map((n) => {
        const e = empMap.get(n.employeeId);
        return [e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : `#${n.employeeId}`, n.trainingSchedule?.trainingProgram?.name ?? '—', n.trainingSchedule?.title ?? `#${n.trainingScheduleId}`, n.trainingSchedule?.scheduledDate?.toISOString().slice(0, 10) ?? null, n.status, n.trainingSchedule?.status ?? '—'];
      });
      break;
    }

    case 'annual': {
      const year = sp.get('year') ?? String(new Date().getFullYear());
      const plans = await prisma.trainingPlan.findMany({
        where: { companyId, deletedAt: null, year },
        include: { lines: { where: { deletedAt: null }, include: { trainingProgram: { select: { name: true } } } } },
      });
      columns = ['Plan', 'Status', 'Month', 'Program', 'Participants', 'Est. Cost', 'Mandatory', 'Line Status'];
      for (const p of plans) {
        for (const l of p.lines) {
          rows.push([p.title ?? `Plan ${p.id}`, p.status, l.plannedMonth, l.trainingProgram?.name ?? `#${l.trainingProgramId}`, l.participantCount, l.estimatedCost != null ? Number(l.estimatedCost) : null, l.isMandatory ? 'Yes' : 'No', l.status]);
        }
      }
      break;
    }

    case 'monthly': {
      const year = sp.get('year') ?? String(new Date().getFullYear());
      const month = sp.get('month') ? parseInt(sp.get('month')!) : new Date().getMonth() + 1;
      const plans = await prisma.trainingPlan.findMany({
        where: { companyId, deletedAt: null, year },
        include: { lines: { where: { deletedAt: null, plannedMonth: month }, include: { trainingProgram: { select: { name: true } } } } },
      });
      columns = ['Plan', 'Program', 'Participants', 'Trainer', 'Method', 'Est. Cost', 'Mandatory', 'Status'];
      for (const p of plans) {
        for (const l of p.lines) {
          rows.push([p.title ?? `Plan ${p.id}`, l.trainingProgram?.name ?? `#${l.trainingProgramId}`, l.participantCount, l.trainerId, l.trainingMethod, l.estimatedCost != null ? Number(l.estimatedCost) : null, l.isMandatory ? 'Yes' : 'No', l.status]);
        }
      }
      break;
    }

    case 'feedback': {
      const data = await prisma.trainingFeedback.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      const scheds = await prisma.trainingSchedule.findMany({ where: { id: { in: data.map((d) => d.trainingScheduleId) } }, select: { id: true, title: true } });
      const sMap = new Map(scheds.map((s) => [s.id, s.title ?? `#${s.id}`]));
      columns = ['Schedule', 'Employee', 'Trainer', 'Content', 'Material', 'Duration', 'Relevance', 'Outcome', 'Venue', 'Overall'];
      rows = data.map((f) => [sMap.get(f.trainingScheduleId) ?? `#${f.trainingScheduleId}`, f.employeeId, f.trainerRating, f.contentRating, f.materialRating, f.durationRating, f.relevanceRating, f.learningOutcomeRating, f.venueRating, f.overallRating]);
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  return NextResponse.json({ type, columns, rows });
}
