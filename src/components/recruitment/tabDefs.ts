/**
 * Tab definitions for the Recruitment module's tab-based pages.
 * Plain module (no 'use client') so both server pages and the client tab
 * strip can import it — mirrors components/masters/employeeMasterTabs.ts.
 * (Named tabDefs rather than recruitmentTabs so it can't collide with
 * RecruitmentTabs.tsx on case-insensitive filesystems.)
 *
 * BRD v6.4 §16.4: Recruitment sidebar collapses to 4 groups, each a single
 * page with tabs inside. Old flat routes redirect to these tab URLs.
 */

export type RecruitmentTabDef = {
  key: string;
  label: string;
  /** BRD section(s) this tab implements. */
  brd: string;
  /** What the tab will contain once built. */
  summary: string;
  /** Nested sub-tabs (Joining tab inside Offer & Joining). */
  subs?: readonly RecruitmentTabDef[];
};

export const RECRUITMENT_PATHS = {
  dashboard: '/recruitment/dashboard',
  applicants: '/recruitment/applicants',
  interviews: '/recruitment/interviews',
  offerJoining: '/recruitment/offer-joining',
  jobPostings: '/recruitment/job-postings',
  internship: '/recruitment/internship',
} as const;

/* ------------------------------ Applicants ------------------------------ */

export const APPLICANT_TABS = [
  {
    key: 'pipeline',
    label: 'Applicant Pipeline',
    brd: '§5.2, §5.19',
    summary:
      'Stage-wise candidate grid (New → Screening → Call → Interview → Evaluation → Verification → Selected → Offer → Joined) with filters for date range, department, designation, stage, level, interviewer and status. Row click opens Candidate 360°.',
  },
  {
    key: 'new-applicant',
    label: 'New Applicant',
    brd: '§5.3',
    summary:
      'Applicant registration — auto application number, personal details, department → designation cascade, source/reference, and duplicate checks on Aadhaar, mobile and email (soft warning).',
  },
  {
    key: 'candidate-360',
    label: 'Candidate 360°',
    brd: '§5.18',
    summary:
      'Single-candidate page: header with stage + action buttons (Call / Schedule / Evaluate / Documents / Offer / Convert to Employee) and sub-tabs — Overview, Personal, Application, Call, Interview, Evaluation, Documents, Offer, Joining, Activity Log.',
  },
  {
    key: 'call-interview',
    label: 'Call Interview',
    brd: '§5.4, §5.5',
    summary:
      'Call screening — recruiter, call outcome (Connected / Call Back / No Response / Rejected / Proceed to Interview), expected salary, notice period, remarks. "Proceed to Interview" auto-sends the interview invitation email.',
  },
] as const satisfies readonly RecruitmentTabDef[];

export type ApplicantTabKey = (typeof APPLICANT_TABS)[number]['key'];

/* ------------------------------ Interviews ------------------------------ */

export const INTERVIEW_TABS = [
  {
    key: 'scheduling',
    label: 'Scheduling',
    brd: '§5.7, §5.9',
    summary:
      'Level-based interview scheduling driven by the Interview Process master (dept + designation → levels). Interviewer dropdown is filtered by the Interview Panel master; scheduling snapshots the criteria config.',
  },
  {
    key: 'my-interviews',
    label: 'My Interviews',
    brd: '§5.10',
    summary: 'Interviewer queue — candidates assigned to the signed-in interviewer, pending or awaiting evaluation.',
  },
  {
    key: 'evaluation',
    label: 'Evaluation',
    brd: '§5.11, §5.12',
    summary:
      'Scorecard rendered from the scheduled config snapshot — per-criteria scores, auto weighted total, minimum passing score check, Pass/Fail/Hold/Re-interview recommendation, strengths & weaknesses.',
  },
  {
    key: 'verification',
    label: 'Document Verification',
    brd: '§5.13, §10.3',
    summary:
      'Required documents per Document Type master (filtered by dept/designation/employment type) — upload, verify, reject with remarks, re-upload requests. Background verification steps appear here.',
  },
] as const satisfies readonly RecruitmentTabDef[];

export type InterviewTabKey = (typeof INTERVIEW_TABS)[number]['key'];

/* --------------------------- Joining sub-tabs --------------------------- */

export const JOINING_SUB_TABS = [
  { key: 'checklist', label: 'Joining Checklist', brd: '§7.1', summary: 'Configurable checklist of forms/documents to collect before joining is complete. On HOLD pending template.' },
  { key: 'application', label: 'Application Form', brd: '§7.2', summary: '19-field application/joining form + PDF generation.' },
  { key: 'joining-report', label: 'Joining Report', brd: '§7.3', summary: 'Joining-day report — location, grade, reported-to, signatures + PDF.' },
  { key: 'gratuity', label: 'Gratuity Form F', brd: '§7.4', summary: 'Gratuity nomination — nominees with proportion, declarations, witnesses + PDF.' },
  { key: 'pf', label: 'PF Form 2', brd: '§7.5', summary: 'PF nomination — Aadhaar, UAN, nominee details + PDF.' },
  { key: 'esi', label: 'ESI Form 1', brd: '§7.6', summary: 'ESI application — applicability check (salary ≤ ceiling), IP number, nominee + PDF.' },
  { key: 'insurance', label: 'Insurance Form', brd: '§7.7', summary: 'Insurance enrollment — policy, coverage, nominee, dependents. On HOLD pending template.' },
  { key: 'other-documents', label: 'Other Documents', brd: '§7.8', summary: 'Generic upload for miscellaneous joining documents. On HOLD pending spec.' },
  { key: 'joining-approval', label: 'Joining Approval', brd: '§8', summary: 'Approval gate between Offer Accepted and Joined — routed via Joining Approval Matrix.' },
  { key: 'push-to-employee', label: 'Push to Employee', brd: '§5.17, §9', summary: 'Convert candidate to Employee Master — field mapping review, auto Employee ID generation.' },
] as const satisfies readonly RecruitmentTabDef[];

export type JoiningSubTabKey = (typeof JOINING_SUB_TABS)[number]['key'];

/* ---------------------------- Offer & Joining ---------------------------- */

export const OFFER_JOINING_TABS = [
  {
    key: 'selection',
    label: 'Final Selection',
    brd: '§5.14',
    summary:
      'Proposed salary, joining date, employment type, reporting manager → routed through the Recruitment Approval Matrix before offer generation.',
  },
  {
    key: 'offer',
    label: 'Offer Letter',
    brd: '§5.15',
    summary:
      'Offer template → auto-populated preview → PDF (HRM/OFL/YYYY numbering) → email → status tracking (Draft → Sent → Accepted / Rejected / Expired).',
  },
  {
    key: 'appointment',
    label: 'Appointment Order',
    brd: '§6.1',
    summary:
      'Appointment letter PDF (KAPLHR/Appt/YYYY numbering) with salary annexure, probation, notice and non-compete clauses. Declined → revert to Offer Pending.',
  },
  {
    key: 'joining',
    label: 'Joining',
    brd: '§5.16, §7, §8, §5.17',
    summary: 'Joining workflow — checklist, statutory forms, approval, and conversion to employee.',
    subs: JOINING_SUB_TABS,
  },
] as const satisfies readonly RecruitmentTabDef[];

export type OfferJoiningTabKey = (typeof OFFER_JOINING_TABS)[number]['key'];

/* ------------------------------- Helpers ------------------------------- */

export function findRecruitmentTab<T extends { readonly key: string }>(
  tabs: readonly T[],
  key: unknown,
): T {
  return tabs.find((t) => t.key === key) ?? tabs[0];
}
