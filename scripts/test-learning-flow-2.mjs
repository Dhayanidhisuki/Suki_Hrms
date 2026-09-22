/**
 * Phase-2 Learning lifecycle test — secondary flows:
 * QR check-in (self-service), monthly plan generate+workflow, OJT sign-off,
 * schedule conflicts, nomination cutoff, completed-record protection,
 * ESS my-trainings, availability endpoint.
 *
 *   node scripts/test-learning-flow-2.mjs
 */

import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000';
try { process.loadEnvFile('.env'); } catch { /* .env optional if JWT_SECRET is set in the shell */ }
const SECRET = process.env.JWT_SECRET ?? 'suki-hrms-super-secret-jwt-key';

// Admin token (role 6) and an ESS employee token (userId 21 → employee 372 "Suresh").
const ADMIN = jwt.sign({ userId: 1, companyId: 1, roleId: 6 }, SECRET, { expiresIn: '2h' });
const EMP = jwt.sign({ userId: 21, companyId: 1, roleId: 6 }, SECRET, { expiresIn: '2h' });
const NONADMIN = jwt.sign({ userId: 1, companyId: 1, roleId: 999 }, SECRET, { expiresIn: '2h' }); // role 999 doesn't exist → not admin

const EMPLOYEE_ID = 372;
const PROGRAM_ID = 1;
const TRAINER_ID = 1;
const VENUE_ID = 1;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const results = [];
function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, body, token = ADMIN) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

async function approveUntil(path) {
  // Multi-stage chains may need repeated APPROVE calls until the record lands APPROVED.
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = await api('PATCH', path, { action: 'APPROVE' });
    const s = last.json?.status ?? last.json?.outcome;
    if (s === 'APPROVED' || s === 'NOMINATED') return { ok: true, status: s };
    if (last.status !== 200) break;
  }
  return { ok: false, status: last?.json?.status ?? last?.json?.outcome ?? last?.status };
}

// ── Cleanup: remove prior E2E check-in schedules for today (whole-day window
// blocks any new same-trainer/venue booking — the conflict check working).
const prior = await api('GET', `/training-schedules?date=${today}`);
const priorList = Array.isArray(prior.json) ? prior.json : prior.json?.data ?? [];
for (const s of priorList.filter((x) => /E2E Check-in/.test(x.title ?? ''))) {
  await api('DELETE', `/training-schedules/${s.id}`);
}

// ── A. Schedule dated TODAY for check-in ─────────────────────────────────────
const sched = await api('POST', '/training-schedules', {
  trainingProgramId: PROGRAM_ID,
  title: 'E2E Check-in Session (today)',
  scheduledDate: today,
  startTime: '00:05', // long past → check-in will be LATE (still valid)
  endTime: '23:55',
  duration: 2,
  venueId: VENUE_ID,
  trainerId: TRAINER_ID,
  maxParticipants: 10,
});
step('A. Today schedule created', sched.status === 200 || sched.status === 201, `id=${sched.json?.id}${sched.status > 201 ? ' ' + JSON.stringify(sched.json) : ''}`);
const schedId = sched.json?.id;

// QR payload
const qr = await api('GET', `/training-schedules/${schedId}/qr`);
step('B. QR payload issued', qr.status === 200 && !!qr.json?.checkInUrl, qr.json?.checkInUrl ?? 'none');

// Nomination within cutoff → expect rejection WITHOUT override (policy cutoff = 3 days)
const nomBlocked = await api('POST', '/training-nominations', {
  trainingScheduleId: schedId, employeeId: EMPLOYEE_ID, reason: 'cutoff test',
});
step('C. Nomination cutoff enforced', nomBlocked.status === 409, `status=${nomBlocked.status} ${nomBlocked.json?.error ?? ''}`);

// Admin override → nomination allowed
const nom = await api('POST', '/training-nominations?override=1', {
  trainingScheduleId: schedId, employeeId: EMPLOYEE_ID, reason: 'check-in test',
});
step('D. Admin override nomination', nom.status === 201, `id=${nom.json?.id}`);
const nomId = nom.json?.id;

const nomAppr = await approveUntil(`/training-nominations/${nomId}`);
step('E. Nomination fully approved', nomAppr.ok, `→ ${nomAppr.status}`);

// Check-in requires schedule status SCHEDULED/IN_PROGRESS — progress it.
const schedUp = await api('PUT', `/training-schedules/${schedId}`, { status: 'SCHEDULED' });
step('E2. Schedule moved to SCHEDULED', schedUp.status === 200 && schedUp.json?.status === 'SCHEDULED', `→ ${schedUp.json?.status ?? schedUp.json?.error}`);

// ── Self check-in as the employee (ESS token userId 21 → employee 372) ───────
const chk1 = await api('POST', `/training-schedules/${schedId}/check-in`, {}, EMP);
step('F. Self check-in', chk1.status === 201 || chk1.status === 200,
  `status=${chk1.status} → ${chk1.json?.data?.status ?? chk1.json?.message ?? JSON.stringify(chk1.json)}`);

const chk2 = await api('POST', `/training-schedules/${schedId}/check-in`, {}, EMP);
step('G. Check-in idempotent', chk2.status === 200 && /already/i.test(chk2.json?.message ?? ''), chk2.json?.message ?? '');

// ── Monthly plan: generateFromAnnual + full workflow ─────────────────────────
const mp = await api('POST', '/monthly-training-plans', {
  year: 2026, month: 10, generateFromAnnual: true, remarks: 'E2E monthly plan',
});
const mpLineCount = mp.json?.lines?.length ?? mp.json?._count?.lines ?? 0;
step('H. Monthly plan generated from annual', (mp.status === 200 || mp.status === 201) && mpLineCount > 0,
  `id=${mp.json?.id} lines=${mpLineCount}${mp.status > 201 ? ' ' + JSON.stringify(mp.json) : ''}`);
const mpId = mp.json?.id;

const wf = [];
for (const action of ['SUBMIT', 'REVIEW', 'APPROVE', 'SCHEDULE', 'START', 'COMPLETE']) {
  const r = await api('PATCH', `/monthly-training-plans/${mpId}`, { action });
  wf.push(`${action}→${r.json?.status ?? r.status}`);
}
// No GET-by-id on this route — verify final state from the last PATCH response.
const mpFinalStatus = wf[wf.length - 1]?.split('→')[1];
step('I. Monthly plan workflow chain', mpFinalStatus === 'COMPLETED', wf.join(' '));

// ── OJT create → complete → auto sign-off ────────────────────────────────────
const ojt = await api('POST', '/ojt-assignments', {
  employeeId: EMPLOYEE_ID,
  trainingProgramId: PROGRAM_ID,
  startDate: today,
  skillsCovered: 'Welding torch handling',
  observation: 'E2E OJT',
});
step('J. OJT assigned', ojt.status === 200 || ojt.status === 201, `id=${ojt.json?.id}`);
const ojtId = ojt.json?.id;

const ojtDone = await api('PUT', `/ojt-assignments/${ojtId}`, {
  employeeId: EMPLOYEE_ID,
  trainingProgramId: PROGRAM_ID,
  startDate: today,
  skillsCovered: 'Welding torch handling',
  status: 'COMPLETED',
  assessmentScore: 85,
});
step('K. OJT completed + signed off',
  ojtDone.status === 200 && ojtDone.json?.signOffByUserId != null && ojtDone.json?.signOffDate != null,
  `signOffBy=${ojtDone.json?.signOffByUserId} date=${ojtDone.json?.signOffDate} score=${ojtDone.json?.assessmentScore}`);

// ── Schedule conflict: same trainer + venue + overlapping time → 409 ─────────
const conflict = await api('POST', '/training-schedules', {
  trainingProgramId: PROGRAM_ID,
  title: 'E2E Conflicting Session',
  scheduledDate: today,
  startTime: '10:00',
  endTime: '12:00',
  venueId: VENUE_ID,
  trainerId: TRAINER_ID,
});
step('L. Double-booking rejected', conflict.status === 409, `status=${conflict.status} ${conflict.json?.error ?? ''}`);

// ── Completed-record delete protection (non-admin) — schedule 6 is COMPLETED ─
const delCompleted = await api('DELETE', '/training-schedules/6', null, NONADMIN);
step('M. Completed-record delete blocked (non-admin)', [400, 401, 403].includes(delCompleted.status),
  `status=${delCompleted.status} ${delCompleted.json?.error ?? ''}`);

// ── ESS my-trainings (employee token) ────────────────────────────────────────
const ess = await api('GET', '/my-trainings', null, EMP);
const essKeys = ess.json ? Object.keys(ess.json.data ?? ess.json) : [];
step('N. ESS my-trainings payload', ess.status === 200 && essKeys.length > 0,
  `keys=[${essKeys.slice(0, 6).join(',')}]`);

// ── Availability endpoint ────────────────────────────────────────────────────
const avail = await api('GET', `/training-schedules/availability?date=${today}`);
const venue = avail.json?.venues?.find((v) => v.id === VENUE_ID);
step('O. Venue availability reflects booking', avail.status === 200 && venue != null,
  venue ? `venue=${venue.name} available=${venue.available} bookings=${venue.bookings?.length}` : `status=${avail.status}`);

// ── Summary ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
