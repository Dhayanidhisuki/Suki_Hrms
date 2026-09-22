/**
 * End-to-end Learning lifecycle test — BRD §40 flow:
 * TNA → approve → plan → approve → schedule → nominate → approve →
 * attendance → assessment → feedback → effectiveness → close →
 * history + certificate + competency update.
 *
 *   node scripts/test-learning-flow.mjs
 */

import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000';
try { process.loadEnvFile('.env'); } catch { /* .env optional if JWT_SECRET is set in the shell */ }
const SECRET = process.env.JWT_SECRET ?? 'suki-hrms-super-secret-jwt-key';
const TOKEN = jwt.sign(
  { userId: 1, companyId: 1, roleId: 6 },
  SECRET,
  { expiresIn: '2h' }
);
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const EMPLOYEE_ID = 372;      // active employee in company 1
const COMPETENCY_ID = 1;      // Welding Safety
const PROGRAM_ID = 1;         // Welding Safety Advanced (competencyId 1)
const TRAINER_ID = 1;
const VENUE_ID = 1;

const results = [];
function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// Randomized far-future date so repeated runs don't collide on trainer/venue double-booking.
const schedDate = new Date(Date.now() + (60 + Math.floor(Math.random() * 300)) * 86400000).toISOString().slice(0, 10);

// ── 1. TNA ───────────────────────────────────────────────────────────────────
const tna = await api('POST', '/training-needs', {
  employeeId: EMPLOYEE_ID,
  competencyId: COMPETENCY_ID,
  source: 'SKILL_GAP',
  reason: 'E2E flow test — competency gap on Welding Safety',
  priority: 'HIGH',
  status: 'PENDING',
  tnaYear: 2026,
  businessImpact: 'E2E test impact',
  proposedMethod: 'CLASSROOM',
});
step('1. TNA created', tna.status === 201 || tna.status === 200, `status=${tna.status} id=${tna.json?.id}`);
const tnaId = tna.json?.id;

// ── 2. TNA approve ───────────────────────────────────────────────────────────
const tnaApprove = await api('PATCH', `/training-needs/${tnaId}`, { action: 'APPROVE' });
step('2. TNA approved', tnaApprove.status === 200, `status=${tnaApprove.status} → ${tnaApprove.json?.status ?? tnaApprove.json?.outcome}`);

// ── 3. Annual plan + line ────────────────────────────────────────────────────
const plan = await api('POST', '/training-plans', {
  year: '2026',
  title: 'E2E Test Annual Plan',
  status: 'DRAFT',
});
step('3a. Annual plan created', plan.status === 200 || plan.status === 201, `status=${plan.status} id=${plan.json?.id}`);
const planId = plan.json?.id;

const line = await api('POST', '/training-plan-lines', {
  trainingPlanId: planId,
  plannedMonth: 10,
  competencyId: COMPETENCY_ID,
  trainingProgramId: PROGRAM_ID,
  trainerId: TRAINER_ID,
  participantCount: 5,
});
step('3b. Plan line added', line.status === 200 || line.status === 201, `status=${line.status} id=${line.json?.id}`);
const planLineId = line.json?.id;

const planApprove = await api('PATCH', `/training-plans/${planId}`, { action: 'APPROVE' });
step('3c. Plan approved', planApprove.status === 200, `status=${planApprove.status} → ${planApprove.json?.status ?? planApprove.json?.outcome}`);

// ── 4. Schedule ──────────────────────────────────────────────────────────────
const sched = await api('POST', '/training-schedules', {
  trainingPlanLineId: planLineId,
  trainingProgramId: PROGRAM_ID,
  title: 'E2E Welding Safety Session',
  scheduledDate: schedDate,
  startTime: '10:00',
  endTime: '14:00',
  duration: 4,
  method: 'CLASSROOM',
  venueId: VENUE_ID,
  trainerId: TRAINER_ID,
  maxParticipants: 5,
  assessmentRequired: true,
  certificationRequired: true,
  feedbackRequired: true,
});
step('4. Schedule created', sched.status === 200 || sched.status === 201, `status=${sched.status} id=${sched.json?.id} date=${schedDate}`);
const schedId = sched.json?.id;

// ── 5. Nomination ────────────────────────────────────────────────────────────
const nom = await api('POST', '/training-nominations', {
  trainingScheduleId: schedId,
  employeeId: EMPLOYEE_ID,
  reason: 'E2E test nomination',
  priority: 'HIGH',
});
step('5. Nomination created', nom.status === 201, `status=${nom.status} id=${nom.json?.id}${nom.status !== 201 ? ' ' + JSON.stringify(nom.json) : ''}`);
const nomId = nom.json?.id;

const nomApprove = await api('PATCH', `/training-nominations/${nomId}`, { action: 'APPROVE' });
step('6. Nomination approved', nomApprove.status === 200, `status=${nomApprove.status} → ${nomApprove.json?.status ?? nomApprove.json?.outcome}`);

// ── 7. Attendance (bulk mark) ────────────────────────────────────────────────
const att = await api('POST', '/training-attendance', {
  trainingScheduleId: schedId,
  rows: [{ employeeId: EMPLOYEE_ID, status: 'PRESENT', attendedDuration: 4, scheduledDuration: 4 }],
});
step('7. Attendance marked', att.status === 200 || att.status === 201, `status=${att.status}`);

// ── 8. Assessment ────────────────────────────────────────────────────────────
const q = await api('POST', '/question-bank', {
  question: 'E2E: Welding requires PPE?',
  questionType: 'TRUE_FALSE',
  correctAnswer: 'True',
  maxScore: 10,
  competencyId: COMPETENCY_ID,
});
step('8a. Question created', q.status === 200 || q.status === 201, `status=${q.status} id=${q.json?.id}`);
const qId = q.json?.id;

const asmt = await api('POST', '/assessments', {
  trainingProgramId: PROGRAM_ID,
  trainingScheduleId: schedId,
  title: 'E2E Post-Test',
  assessmentType: 'POST',
  passingScore: 70,
  maxAttempts: 2,
  questionIds: JSON.stringify([qId]),
});
step('8b. Assessment created', asmt.status === 200 || asmt.status === 201, `status=${asmt.status} id=${asmt.json?.id}${asmt.status > 201 ? ' ' + JSON.stringify(asmt.json) : ''}`);
const asmtId = asmt.json?.id;

const start = await api('POST', '/assessment-attempts', { assessmentId: asmtId, employeeId: EMPLOYEE_ID });
step('8c. Attempt started', start.status === 200 || start.status === 201, `status=${start.status}${start.status > 201 ? ' ' + JSON.stringify(start.json) : ''}`);

const submit = await api('POST', '/assessment-attempts', {
  assessmentId: asmtId,
  employeeId: EMPLOYEE_ID,
  answersJson: JSON.stringify([{ questionId: qId, answer: 'True' }]),
});
step('8d. Attempt submitted + scored', submit.status === 200 || submit.status === 201,
  `status=${submit.status} score=${submit.json?.score ?? submit.json?.attempt?.score} passed=${submit.json?.passed ?? submit.json?.attempt?.passed}${submit.status > 201 ? ' ' + JSON.stringify(submit.json) : ''}`);

// ── 9. Feedback ──────────────────────────────────────────────────────────────
const fb = await api('POST', '/training-feedback', {
  trainingScheduleId: schedId,
  employeeId: EMPLOYEE_ID,
  trainerRating: 5,
  contentRating: 5,
  venueRating: 4,
  overallRating: 5,
  materialRating: 4,
  durationRating: 4,
  relevanceRating: 5,
  learningOutcomeRating: 5,
  comments: 'E2E test feedback',
});
step('9. Feedback submitted', fb.status === 200 || fb.status === 201, `status=${fb.status}${fb.status > 201 ? ' ' + JSON.stringify(fb.json) : ''}`);

// ── 10. Effectiveness (manager eval avg ≥4 → promotes competency level) ──────
const lvlBefore = await api('GET', `/skill-matrix?employeeId=${EMPLOYEE_ID}`);
const compBefore = lvlBefore.json?.data?.find((r) => r.itemType !== 'SKILL' && r.competencyId === COMPETENCY_ID);

const eff = await api('POST', '/training-effectiveness', {
  trainingScheduleId: schedId,
  employeeId: EMPLOYEE_ID,
  preScore: 40,
  postScore: 90,
  level1Reaction: 5,
  level3Behavior: 4,
  level4Results: 4,
  applicationOfLearning: 5,
  behavioralChange: 5,
  skillImprovement: 5,
  productivityImprovement: 4,
  qualityImprovement: 4,
  evaluationStage: 'IMMEDIATE',
  effectivenessRating: 'HIGH',
});
step('10. Effectiveness recorded', eff.status === 200 || eff.status === 201, `status=${eff.status} rating=${eff.json?.effectivenessRating}${eff.status > 201 ? ' ' + JSON.stringify(eff.json) : ''}`);

const lvlAfter = await api('GET', `/skill-matrix?employeeId=${EMPLOYEE_ID}`);
const compAfter = lvlAfter.json?.data?.find((r) => r.itemType !== 'SKILL' && r.competencyId === COMPETENCY_ID);
// Promotion can't exceed the highest configured SkillLevel; at max the correct outcome is "unchanged".
const lvls = await api('GET', '/skill-levels');
const maxLevel = Math.max(0, ...(lvls.json?.data ?? []).map((l) => l.levelNumber ?? 0));
const alreadyMax = (compBefore?.currentLevelNumber ?? 0) >= maxLevel && maxLevel > 0;
step('10b. Competency level promoted',
  alreadyMax
    ? (compAfter?.currentLevelNumber ?? 0) === (compBefore?.currentLevelNumber ?? 0)
    : (compAfter?.currentLevelNumber ?? 0) > (compBefore?.currentLevelNumber ?? 0),
  `${compBefore?.currentLevelName ?? '—'} → ${compAfter?.currentLevelName ?? '—'}${alreadyMax ? ' (already at max)' : ''}`);

// ── 11. Close schedule → history + certificate ───────────────────────────────
const close = await api('POST', `/training-schedules/${schedId}/complete`, { status: 'COMPLETED' });
step('11. Schedule closed', close.status === 200,
  `status=${close.status} historyRows=${close.json?.historyRows} certs=${close.json?.certificatesIssued}${close.status !== 200 ? ' ' + JSON.stringify(close.json) : ''}`);

// ── 12. Verify history + certificate ─────────────────────────────────────────
const hist = await api('GET', `/training-history?employeeId=${EMPLOYEE_ID}`);
const histRows = hist.json?.data ?? hist.json ?? [];
const myHist = Array.isArray(histRows) ? histRows.find((h) => h.trainingScheduleId === schedId) : null;
step('12a. Training history written', !!myHist,
  myHist ? `result=${myHist.result} duration=${myHist.duration} cert=${myHist.certificateNumber}` : 'no row found');

const certs = await api('GET', `/training-certificates?employeeId=${EMPLOYEE_ID}`);
const certRows = certs.json?.data ?? certs.json ?? [];
const myCert = Array.isArray(certRows) ? certRows.find((c) => c.trainingScheduleId === schedId) : null;
step('12b. Certificate issued', !!myCert, myCert ? `number=${myCert.certificateNumber}` : 'none found');

// ── 13. Dashboard KPIs ───────────────────────────────────────────────────────
const dash = await api('GET', '/training-dashboard');
step('13. Dashboard live', dash.status === 200, `upcoming=${dash.json?.data?.kpis?.schedulesUpcoming} completedThisMonth=${dash.json?.data?.kpis?.schedulesCompletedThisMonth}`);

// ── Summary ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
