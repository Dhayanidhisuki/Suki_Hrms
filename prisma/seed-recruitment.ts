/**
 * Seed script for the Recruitment & Onboarding module (BRD v6.4).
 * Run with: npx tsx prisma/seed-recruitment.ts
 *
 * Seeds: RecruitmentStatus (20), SourcingChannel (8), BgvStep (7),
 * SlaConfig (8), ChecklistMaster (15), EmployeeIdConfig (singleton),
 * InterviewType (3 defaults), InterviewLevel (4 defaults).
 * EmailTemplate seeding is skipped — body content should be configured
 * per company by the admin via the Email Template Master UI.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── RecruitmentStatus (20 lifecycle states, BRD §12.10) ──────────────
  const statuses = [
    { sequence: 1,  statusCode: 'NEW',                statusName: 'New',                stageCategory: 'Screening',   isTerminal: false, color: '#3b82f6' },
    { sequence: 2,  statusCode: 'SCREENING',          statusName: 'Screening',          stageCategory: 'Screening',   isTerminal: false, color: '#3b82f6' },
    { sequence: 3,  statusCode: 'CALL_INTERVIEW',     statusName: 'Call Interview',      stageCategory: 'Screening',   isTerminal: false, color: '#f59e0b' },
    { sequence: 4,  statusCode: 'INTERVIEW_SCHEDULED', statusName: 'Interview Scheduled', stageCategory: 'Interview',  isTerminal: false, color: '#8b5cf6' },
    { sequence: 5,  statusCode: 'INTERVIEW_LEVEL_1',   statusName: 'Interview Level 1',   stageCategory: 'Interview',  isTerminal: false, color: '#8b5cf6' },
    { sequence: 6,  statusCode: 'INTERVIEW_LEVEL_2',   statusName: 'Interview Level 2',   stageCategory: 'Interview',  isTerminal: false, color: '#8b5cf6' },
    { sequence: 7,  statusCode: 'INTERVIEW_LEVEL_3',   statusName: 'Interview Level 3',   stageCategory: 'Interview',  isTerminal: false, color: '#8b5cf6' },
    { sequence: 8,  statusCode: 'DOCUMENT_VERIFICATION', statusName: 'Document Verification', stageCategory: 'Verification', isTerminal: false, color: '#f59e0b' },
    { sequence: 9,  statusCode: 'FINAL_APPROVAL',      statusName: 'Final Approval',      stageCategory: 'Selection',  isTerminal: false, color: '#f59e0b' },
    { sequence: 10, statusCode: 'OFFER_GENERATED',    statusName: 'Offer Generated',     stageCategory: 'Offer',      isTerminal: false, color: '#10b981' },
    { sequence: 11, statusCode: 'OFFER_SENT',         statusName: 'Offer Sent',          stageCategory: 'Offer',      isTerminal: false, color: '#10b981' },
    { sequence: 12, statusCode: 'OFFER_ACCEPTED',     statusName: 'Offer Accepted',      stageCategory: 'Offer',      isTerminal: false, color: '#10b981' },
    { sequence: 13, statusCode: 'JOINING_PENDING',    statusName: 'Joining Pending',     stageCategory: 'Joining',    isTerminal: false, color: '#f59e0b' },
    { sequence: 14, statusCode: 'JOINING_APPROVAL',   statusName: 'Joining Approval',    stageCategory: 'Joining',    isTerminal: false, color: '#f59e0b' },
    { sequence: 15, statusCode: 'JOINED',             statusName: 'Joined',              stageCategory: 'Joining',    isTerminal: false, color: '#10b981' },
    { sequence: 16, statusCode: 'EMPLOYEE_CREATED',   statusName: 'Employee Created',    stageCategory: 'Joining',    isTerminal: false, color: '#10b981' },
    { sequence: 17, statusCode: 'REJECTED',           statusName: 'Rejected',            stageCategory: 'Screening',  isTerminal: true,  color: '#ef4444' },
    { sequence: 18, statusCode: 'ON_HOLD',             statusName: 'On Hold',             stageCategory: 'Screening',  isTerminal: true,  color: '#f59e0b' },
    { sequence: 19, statusCode: 'WITHDRAWN',           statusName: 'Withdrawn',           stageCategory: 'Screening',  isTerminal: true,  color: '#6b7280' },
    { sequence: 20, statusCode: 'CANCELLED',           statusName: 'Cancelled',           stageCategory: 'Screening',  isTerminal: true,  color: '#6b7280' },
  ];
  for (const s of statuses) {
    await prisma.recruitmentStatus.upsert({
      where: { statusCode: s.statusCode },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${statuses.length} RecruitmentStatus rows`);

  // ── SourcingChannel (8, BRD §10.1) ────────────────────────────────────
  const channels = [
    { channelCode: 'NAUKRI',     channelName: 'Job Portal — Naukri',    channelType: 'External' },
    { channelCode: 'LINKEDIN',   channelName: 'Job Portal — LinkedIn',   channelType: 'External' },
    { channelCode: 'CAREER_PAGE', channelName: 'Career Page',            channelType: 'Internal' },
    { channelCode: 'REFERRAL',    channelName: 'Employee Referral',       channelType: 'Internal' },
    { channelCode: 'AGENCY',      channelName: 'Consultant/Agency',       channelType: 'External' },
    { channelCode: 'WALKIN',      channelName: 'Walk-in',                 channelType: 'Direct' },
    { channelCode: 'SOCIAL_MEDIA', channelName: 'Social Media',           channelType: 'External' },
    { channelCode: 'OTHER',       channelName: 'Other',                  channelType: 'Custom' },
  ];
  for (const c of channels) {
    await prisma.sourcingChannel.upsert({
      where: { channelCode: c.channelCode },
      update: {},
      create: c,
    });
  }
  console.log(`Seeded ${channels.length} SourcingChannel rows`);

  // ── BgvStep (7, BRD §10.3) ────────────────────────────────────────────
  const bgvSteps = [
    { stepCode: 'DOC_VERIFY',   stepName: 'Document Verification',       sequence: 1 },
    { stepCode: 'REF_CHECK_1', stepName: 'Reference Check 1',           sequence: 2 },
    { stepCode: 'REF_CHECK_2', stepName: 'Reference Check 2',           sequence: 3 },
    { stepCode: 'PREV_EMP',    stepName: 'Previous Employment Verification', sequence: 4 },
    { stepCode: 'EDU_VERIFY',  stepName: 'Education Verification',       sequence: 5 },
    { stepCode: 'ADDR_VERIFY', stepName: 'Address Verification',         sequence: 6 },
    { stepCode: 'POLICE_VERIFY', stepName: 'Police Verification',        sequence: 7 },
  ];
  for (const s of bgvSteps) {
    await prisma.bgvStep.upsert({
      where: { stepCode: s.stepCode },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${bgvSteps.length} BgvStep rows`);

  // ── SlaConfig (8, BRD §10.5) ─────────────────────────────────────────
  const slaConfigs = [
    { stageCode: 'SCREENING',      stageName: 'Screening',              slaDays: 3, escalationRole: 'HR Manager' },
    { stageCode: 'CALL_INTERVIEW',  stageName: 'Call Interview',          slaDays: 2, escalationRole: 'Recruiter' },
    { stageCode: 'INTERVIEW_SCHED', stageName: 'Interview Scheduling',    slaDays: 5, escalationRole: 'Interviewer' },
    { stageCode: 'EVALUATION',      stageName: 'Evaluation',              slaDays: 2, escalationRole: 'Interviewer' },
    { stageCode: 'DOC_VERIFICATION', stageName: 'Document Verification', slaDays: 3, escalationRole: 'HR' },
    { stageCode: 'FINAL_SELECTION', stageName: 'Final Selection',        slaDays: 2, escalationRole: 'Management' },
    { stageCode: 'OFFER_APPROVAL',   stageName: 'Offer Approval',         slaDays: 2, escalationRole: 'Approver' },
    { stageCode: 'JOINING_APPROVAL', stageName: 'Joining Approval',       slaDays: 2, escalationRole: 'Approver' },
  ];
  for (const s of slaConfigs) {
    await prisma.slaConfig.upsert({
      where: { stageCode: s.stageCode },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${slaConfigs.length} SlaConfig rows`);

  // ── ChecklistMaster (15, BRD §7.1) ───────────────────────────────────
  const checklistItems = [
    { itemCode: 'APP_FORM',     itemName: 'Application Form collected',     sourceForm: '§7.2', mandatory: true },
    { itemCode: 'JOIN_REPORT',  itemName: 'Joining Report collected',      sourceForm: '§7.3', mandatory: true },
    { itemCode: 'GRATUITY_F',   itemName: 'Gratuity Nomination Form collected', sourceForm: '§7.4', mandatory: true },
    { itemCode: 'PF_FORM_2',    itemName: 'PF Nomination Form collected',  sourceForm: '§7.5', mandatory: true },
    { itemCode: 'ESI_FORM_1',   itemName: 'ESI Application Form collected', sourceForm: '§7.6', mandatory: true },
    { itemCode: 'INSURANCE',    itemName: 'Insurance Form collected',      sourceForm: '§7.7', mandatory: false },
    { itemCode: 'OTHER_DOCS',   itemName: 'Other Joining Documents collected', sourceForm: '§7.8', mandatory: false },
    { itemCode: 'AADHAAR',      itemName: 'Aadhaar copy collected',        sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'PAN',          itemName: 'PAN copy collected',             sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'BANK_COPY',    itemName: 'Bank Account copy collected',   sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'ACADEMIC',     itemName: 'Academic Certificates verified', sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'RELIEVING',    itemName: 'Relieving letters collected',   sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'SALARY_PROOF', itemName: 'Salary proof (3 months) collected', sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'PHOTOS',       itemName: 'Passport photos collected',     sourceForm: 'Offer Letter', mandatory: true },
    { itemCode: 'DEP_AADHAAR',  itemName: "Dependents' Aadhaar collected",  sourceForm: 'Insurance', mandatory: false },
  ];
  for (const i of checklistItems) {
    await prisma.checklistMaster.upsert({
      where: { itemCode: i.itemCode },
      update: {},
      create: i,
    });
  }
  console.log(`Seeded ${checklistItems.length} ChecklistMaster rows`);

  // ── EmployeeIdConfig (singleton, BRD §9) ────────────────────────────
  await prisma.employeeIdConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { prefix: 'KUN', includeYear: true, includeDepartment: false, sequenceLength: 4, separator: '-', startNumber: 1 },
  });
  console.log('Seeded EmployeeIdConfig (singleton)');

  // ── EmployeeIdSequence (singleton counter) ──────────────────────────
  await prisma.employeeIdSequence.upsert({
    where: { counterKey: 'default' },
    update: {},
    create: { counterKey: 'default', lastNumber: 0 },
  });
  console.log('Seeded EmployeeIdSequence (singleton)');

  // ── InterviewType (3 defaults, BRD §12.2) ────────────────────────────
  const interviewTypes = [
    { typeCode: 'HR',        typeName: 'HR Screening',      mode: 'Online',   durationMins: 30, evaluationRequired: true, scoreRequired: true, remarksRequired: true, interviewerRequired: true, meetingLinkRequired: true, locationRequired: false },
    { typeCode: 'TECHNICAL', typeName: 'Technical Interview', mode: 'Online',   durationMins: 60, evaluationRequired: true, scoreRequired: true, remarksRequired: true, interviewerRequired: true, meetingLinkRequired: true, locationRequired: false },
    { typeCode: 'MANAGERIAL', typeName: 'Managerial Interview', mode: 'Physical', durationMins: 45, evaluationRequired: true, scoreRequired: true, remarksRequired: true, interviewerRequired: true, meetingLinkRequired: false, locationRequired: true },
  ];
  for (const t of interviewTypes) {
    await prisma.interviewType.upsert({
      where: { typeCode: t.typeCode },
      update: {},
      create: t,
    });
  }
  console.log(`Seeded ${interviewTypes.length} InterviewType rows`);

  // ── InterviewLevel (4 defaults, BRD §12.1) ──────────────────────────
  const hrType = await prisma.interviewType.findUnique({ where: { typeCode: 'HR' } });
  const techType = await prisma.interviewType.findUnique({ where: { typeCode: 'TECHNICAL' } });
  const mgrType = await prisma.interviewType.findUnique({ where: { typeCode: 'MANAGERIAL' } });
  if (!hrType || !techType || !mgrType) throw new Error('InterviewType seed failed');

  const levels = [
    { levelCode: 'L1', levelName: 'Level 1 — HR Screening', sequenceNo: 1, interviewTypeId: hrType.id,  mandatory: true, minPassingScore: 60, autoProgressNext: true, allowReinterview: true },
    { levelCode: 'L2', levelName: 'Level 2 — Technical',     sequenceNo: 2, interviewTypeId: techType.id, mandatory: true, minPassingScore: 70, autoProgressNext: true, allowReinterview: true },
    { levelCode: 'L3', levelName: 'Level 3 — Managerial',    sequenceNo: 3, interviewTypeId: mgrType.id, mandatory: true, minPassingScore: 65, autoProgressNext: true, allowReinterview: true },
    { levelCode: 'L4', levelName: 'Level 4 — HR Final',       sequenceNo: 4, interviewTypeId: hrType.id,  mandatory: false, minPassingScore: 60, autoProgressNext: false, allowReinterview: false },
  ];
  for (const l of levels) {
    await prisma.interviewLevel.upsert({
      where: { levelCode: l.levelCode },
      update: {},
      create: l,
    });
  }
  console.log(`Seeded ${levels.length} InterviewLevel rows`);

  console.log('\n✅ Recruitment module seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
