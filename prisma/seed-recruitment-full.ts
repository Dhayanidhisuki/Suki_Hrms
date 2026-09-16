/**
 * Comprehensive Recruitment Seed Data — 2 full candidate datasets.
 *
 * Dataset 1: Full lifecycle — Candidate → Call → Interview → Evaluation →
 *            Document → BGV → Offer → Sent → Accepted → Joining → Approved →
 *            Employee Created. Includes all joining forms, insurance, gratuity,
 *            PF, ESI, appointment order, portal token, messages, communications.
 *
 * Dataset 2: Mid-pipeline — Candidate → Call → Interview Scheduled (not yet evaluated).
 *            Documents uploaded, BGV in progress. Offer not yet created.
 *
 * Also seeds missing masters: InterviewCriteria, InterviewScoreConfig,
 * InterviewPanel, InterviewProcess, InterviewProcessLevel, DocumentType,
 * EmailTemplate, OfferTemplate, AppointmentTemplate, DesignationLevel,
 * RecruitmentApprovalMatrix, JoiningApprovalMatrix, OtherJoiningDocType,
 * InternshipPolicy, JobPosting.
 *
 * Usage: npx tsx prisma/seed-recruitment-full.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helper: get status ID by code ─────────────────────────────────────────────
async function statusId(code: string): Promise<number> {
  const s = await prisma.recruitmentStatus.findUnique({ where: { statusCode: code } });
  if (!s) throw new Error(`Status ${code} not found — run seed-recruitment.ts first`);
  return s.id;
}

async function channelId(code: string): Promise<number> {
  const c = await prisma.sourcingChannel.findUnique({ where: { channelCode: code } });
  if (!c) throw new Error(`Channel ${code} not found`);
  return c.id;
}

async function levelId(code: string): Promise<number> {
  const l = await prisma.interviewLevel.findUnique({ where: { levelCode: code } });
  if (!l) throw new Error(`Level ${code} not found`);
  return l.id;
}

async function typeId(code: string): Promise<number> {
  const t = await prisma.interviewType.findUnique({ where: { typeCode: code } });
  if (!t) throw new Error(`Type ${code} not found`);
  return t.id;
}

async function bgvStepId(code: string): Promise<number> {
  const b = await prisma.bgvStep.findUnique({ where: { stepCode: code } });
  if (!b) throw new Error(`BGV step ${code} not found`);
  return b.id;
}

async function checklistId(code: string): Promise<number> {
  const c = await prisma.checklistMaster.findUnique({ where: { itemCode: code } });
  if (!c) throw new Error(`Checklist ${code} not found`);
  return c.id;
}

async function main() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE RECRUITMENT SEED — 2 Full Datasets');
  console.log('='.repeat(60));

  // ── Resolve reference IDs ──────────────────────────────────────────────────
  const deptId = 1;       // IT Dept
  const desigId = 1;      // Manager
  const interviewerId = 371; // Employee 1
  const mentorId = 372;   // Employee 2 (Suresh)
  const userId = 2;       // superadmin@suki.hrms
  const sNew = await statusId('NEW');
  const sScreening = await statusId('SCREENING');
  const sCall = await statusId('CALL_INTERVIEW');
  const sIntSched = await statusId('INTERVIEW_SCHEDULED');
  const sIntL1 = await statusId('INTERVIEW_LEVEL_1');
  const sDocVer = await statusId('DOCUMENT_VERIFICATION');
  const sFinal = await statusId('FINAL_APPROVAL');
  const sOfferGen = await statusId('OFFER_GENERATED');
  const sOfferSent = await statusId('OFFER_SENT');
  const sOfferAcc = await statusId('OFFER_ACCEPTED');
  const sJoiningPend = await statusId('JOINING_PENDING');
  const sJoiningApp = await statusId('JOINING_APPROVAL');
  const sJoined = await statusId('JOINED');
  const sEmpCreated = await statusId('EMPLOYEE_CREATED');
  const chNaukri = await channelId('NAUKRI');
  const chLinkedIn = await channelId('LINKEDIN');
  const chReferral = await channelId('REFERRAL');
  const l1 = await levelId('L1');
  const l2 = await levelId('L2');
  const l3 = await levelId('L3');
  const tHR = await typeId('HR');
  const tTech = await typeId('TECHNICAL');
  const tMgr = await typeId('MANAGERIAL');
  const bgv1 = await bgvStepId('DOC_VERIFY');
  const bgv2 = await bgvStepId('REF_CHECK_1');
  const bgv3 = await bgvStepId('EDU_VERIFY');
  const bgv4 = await bgvStepId('PREV_EMP');
  const bgv5 = await bgvStepId('ADDR_VERIFY');
  const bgv6 = await bgvStepId('POLICE_VERIFY');
  const clApp = await checklistId('APP_FORM');
  const clJoin = await checklistId('JOIN_REPORT');
  const clGrat = await checklistId('GRATUITY_F');
  const clPf = await checklistId('PF_FORM_2');
  const clEsi = await checklistId('ESI_FORM_1');
  const clIns = await checklistId('INSURANCE');
  const clAadhaar = await checklistId('AADHAAR');
  const clPan = await checklistId('PAN');
  const clBank = await checklistId('BANK_COPY');
  const clAcademic = await checklistId('ACADEMIC');
  const clRelieving = await checklistId('RELIEVING');
  const clSalary = await checklistId('SALARY_PROOF');
  const clPhotos = await checklistId('PHOTOS');
  const clOther = await checklistId('OTHER_DOCS');
  const clDepAadhaar = await checklistId('DEP_AADHAAR');

  // ════════════════════════════════════════════════════════════════════════════
  // PART A: Missing Masters
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- Part A: Seeding Missing Masters ---');

  // ── InterviewCriteria (6 criteria across types) ────────────────────────────
  const criteriaData = [
    { criteriaCode: 'COMM',    criteriaName: 'Communication',     category: 'Communication', interviewTypeId: tHR,   maxScore: 10, weightage: 20, mandatory: true },
    { criteriaCode: 'CULTURE', criteriaName: 'Culture Fit',       category: 'Culture',       interviewTypeId: tHR,   maxScore: 10, weightage: 20, mandatory: true },
    { criteriaCode: 'TECH',    criteriaName: 'Technical Skill',   category: 'Technical',     interviewTypeId: tTech,  maxScore: 10, weightage: 30, mandatory: true },
    { criteriaCode: 'PROB',    criteriaName: 'Problem Solving',   category: 'Analytical',    interviewTypeId: tTech,  maxScore: 10, weightage: 20, mandatory: true },
    { criteriaCode: 'LEAD',    criteriaName: 'Leadership',        category: 'Leadership',    interviewTypeId: tMgr,  maxScore: 10, weightage: 25, mandatory: true },
    { criteriaCode: 'DOMAIN',  criteriaName: 'Domain Knowledge', category: 'Domain',        interviewTypeId: tMgr,  maxScore: 10, weightage: 25, mandatory: true },
  ];
  for (const c of criteriaData) {
    await prisma.interviewCriteria.upsert({
      where: { criteriaCode: c.criteriaCode },
      update: {},
      create: c,
    });
  }
  console.log(`Seeded ${criteriaData.length} InterviewCriteria rows`);

  const critComm = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'COMM' } });
  const cultCult = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'CULTURE' } });
  const critTech = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'TECH' } });
  const critProb = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'PROB' } });
  const critLead = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'LEAD' } });
  const critDomain = await prisma.interviewCriteria.findUnique({ where: { criteriaCode: 'DOMAIN' } });

  // ── InterviewScoreConfig (6 configs) ───────────────────────────────────────
  const scoreConfigs = [
    { configCode: 'SC_L1_COMM',  interviewLevelId: l1, interviewTypeId: tHR,   criteriaId: critComm!.id,  maxScore: 10, passingScore: 60 },
    { configCode: 'SC_L1_CULT',  interviewLevelId: l1, interviewTypeId: tHR,   criteriaId: cultCult!.id,  maxScore: 10, passingScore: 60 },
    { configCode: 'SC_L2_TECH',  interviewLevelId: l2, interviewTypeId: tTech, criteriaId: critTech!.id,  maxScore: 10, passingScore: 70 },
    { configCode: 'SC_L2_PROB',  interviewLevelId: l2, interviewTypeId: tTech, criteriaId: critProb!.id,  maxScore: 10, passingScore: 70 },
    { configCode: 'SC_L3_LEAD',  interviewLevelId: l3, interviewTypeId: tMgr,  criteriaId: critLead!.id,  maxScore: 10, passingScore: 65 },
    { configCode: 'SC_L3_DOM',   interviewLevelId: l3, interviewTypeId: tMgr,  criteriaId: critDomain!.id, maxScore: 10, passingScore: 65 },
  ];
  for (const sc of scoreConfigs) {
    await prisma.interviewScoreConfig.upsert({
      where: { configCode: sc.configCode },
      update: {},
      create: sc,
    });
  }
  console.log(`Seeded ${scoreConfigs.length} InterviewScoreConfig rows`);

  // ── InterviewPanel (3 panels) ──────────────────────────────────────────────
  const panels = [
    { panelCode: 'PANEL_L1_HR',  interviewLevelId: l1, interviewTypeId: tHR,   eligibleInterviewerId: interviewerId },
    { panelCode: 'PANEL_L2_TECH', interviewLevelId: l2, interviewTypeId: tTech, eligibleInterviewerId: interviewerId },
    { panelCode: 'PANEL_L3_MGR', interviewLevelId: l3, interviewTypeId: tMgr,  eligibleInterviewerId: interviewerId },
  ];
  for (const p of panels) {
    await prisma.interviewPanel.upsert({
      where: { panelCode: p.panelCode },
      update: {},
      create: p,
    });
  }
  console.log(`Seeded ${panels.length} InterviewPanel rows`);

  // ── InterviewProcess + ProcessLevels ───────────────────────────────────────
  const process = await prisma.interviewProcess.upsert({
    where: { id: 1 },
    update: {},
    create: { processName: 'Standard IT Hiring Process', departmentId: deptId, designationId: desigId, employmentType: 'Full-time' },
  });
  console.log('Seeded InterviewProcess (1)');

  const processLevels = [
    { processId: process.id, interviewLevelId: l1, interviewTypeId: tHR,   sequence: 1, mandatory: true,  passScore: 60 },
    { processId: process.id, interviewLevelId: l2, interviewTypeId: tTech, sequence: 2, mandatory: true,  passScore: 70 },
    { processId: process.id, interviewLevelId: l3, interviewTypeId: tMgr,  sequence: 3, mandatory: true,  passScore: 65 },
  ];
  for (const pl of processLevels) {
    const existing = await prisma.interviewProcessLevel.findFirst({ where: { processId: pl.processId, interviewLevelId: pl.interviewLevelId } });
    if (!existing) await prisma.interviewProcessLevel.create({ data: pl });
  }
  console.log(`Seeded ${processLevels.length} InterviewProcessLevel rows`);

  // ── DocumentType (6 types) ─────────────────────────────────────────────────
  const docTypes = [
    { documentCode: 'RESUME',   documentName: 'Resume / CV',         category: 'Other',      mandatory: true,  verificationRequired: false, allowedFileTypes: 'pdf,doc,docx', maxFileSizeMb: 5 },
    { documentCode: 'AADHAAR',  documentName: 'Aadhaar Card',        category: 'Identity',    mandatory: true,  verificationRequired: true,  allowedFileTypes: 'pdf,jpg,png', maxFileSizeMb: 2 },
    { documentCode: 'PAN',      documentName: 'PAN Card',             category: 'Identity',    mandatory: true,  verificationRequired: true,  allowedFileTypes: 'pdf,jpg,png', maxFileSizeMb: 2 },
    { documentCode: 'EDU_CERT', documentName: 'Education Certificate', category: 'Education', mandatory: true,  verificationRequired: true,  allowedFileTypes: 'pdf,jpg,png', maxFileSizeMb: 5 },
    { documentCode: 'RELIEVE',  documentName: 'Relieving Letter',     category: 'Employment',  mandatory: false, verificationRequired: true,  allowedFileTypes: 'pdf',         maxFileSizeMb: 3 },
    { documentCode: 'SALARY',   documentName: 'Salary Slip (3 months)', category: 'Employment', mandatory: false, verificationRequired: true,  allowedFileTypes: 'pdf',         maxFileSizeMb: 5 },
  ];
  for (const d of docTypes) {
    await prisma.documentType.upsert({ where: { documentCode: d.documentCode }, update: {}, create: d });
  }
  console.log(`Seeded ${docTypes.length} DocumentType rows`);

  const dtResume = await prisma.documentType.findUnique({ where: { documentCode: 'RESUME' } });
  const dtAadhaar = await prisma.documentType.findUnique({ where: { documentCode: 'AADHAAR' } });
  const dtPan = await prisma.documentType.findUnique({ where: { documentCode: 'PAN' } });
  const dtEdu = await prisma.documentType.findUnique({ where: { documentCode: 'EDU_CERT' } });
  const dtRelieve = await prisma.documentType.findUnique({ where: { documentCode: 'RELIEVE' } });
  const dtSalary = await prisma.documentType.findUnique({ where: { documentCode: 'SALARY' } });

  // ── EmailTemplate (5 templates) ────────────────────────────────────────────
  const emailTemplates = [
    { templateCode: 'INT_CALL',  templateName: 'Interview Call Email',     event: 'interview_scheduled', subject: 'Interview Scheduled — {CompanyName}', body: 'Dear {CandidateName},\n\nYour interview for {Designation} has been scheduled. Please find the details below.\n\nPortal Link: {PortalLink}\n\nRegards,\nHR Team' },
    { templateCode: 'OFFER',     templateName: 'Offer Letter Email',        event: 'offer_sent',          subject: 'Offer Letter from {CompanyName}',     body: 'Dear {CandidateName},\n\nWe are pleased to offer you the position of {Designation}.\n\nPortal Link: {PortalLink}\n\nRegards,\nHR Team' },
    { templateCode: 'REJECT',    templateName: 'Rejection Email',           event: 'rejection',           subject: 'Update on your application',           body: 'Dear {CandidateName},\n\nThank you for your interest. Unfortunately, we are unable to proceed.\n\nRegards,\nHR Team' },
    { templateCode: 'JOIN',      templateName: 'Joining Instructions',       event: 'joining',             subject: 'Joining Instructions — {CompanyName}', body: 'Dear {CandidateName},\n\nYour joining date is confirmed. Please complete the joining formalities via portal.\n\nPortal Link: {PortalLink}\n\nRegards,\nHR Team' },
    { templateCode: 'WELCOME',   templateName: 'Welcome Email',             event: 'welcome',             subject: 'Welcome to {CompanyName}',            body: 'Dear {CandidateName},\n\nWelcome aboard! We are excited to have you join us.\n\nRegards,\nHR Team' },
  ];
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({ where: { templateCode: t.templateCode }, update: {}, create: t });
  }
  console.log(`Seeded ${emailTemplates.length} EmailTemplate rows`);

  // ── OfferTemplate (2 templates) ────────────────────────────────────────────
  const offerTemplates = [
    { templateCode: 'STD_OFFER',  templateName: 'Standard Offer Letter',  employmentType: 'Full-time', version: '1.0' },
    { templateCode: 'EXEC_OFFER', templateName: 'Executive Offer Letter', employmentType: 'Full-time', version: '1.0' },
  ];
  for (const t of offerTemplates) {
    await prisma.offerTemplate.upsert({ where: { templateCode: t.templateCode }, update: {}, create: t });
  }
  console.log(`Seeded ${offerTemplates.length} OfferTemplate rows`);
  const offerTpl = await prisma.offerTemplate.findUnique({ where: { templateCode: 'STD_OFFER' } });

  // ── AppointmentTemplate (1 template) ───────────────────────────────────────
  await prisma.appointmentTemplate.upsert({
    where: { templateCode: 'STD_APPT' },
    update: {},
    create: {
      templateCode: 'STD_APPT',
      templateName: 'Standard Appointment Order',
      subject: 'Appointment Order — {CompanyName}',
      body: 'Dear {CandidateName},\n\nThis is your official appointment order for the position of {Designation}.\n\nRegards,\nHR Team',
      employmentType: 'Full-time',
      version: '1.0',
    },
  });
  console.log('Seeded AppointmentTemplate (1)');
  const apptTpl = await prisma.appointmentTemplate.findUnique({ where: { templateCode: 'STD_APPT' } });

  // ── DesignationLevel (4 levels) ────────────────────────────────────────────
  const desigLevels = [
    { levelCode: 'JUNIOR',  levelName: 'Junior' },
    { levelCode: 'MIDDLE',  levelName: 'Middle' },
    { levelCode: 'SENIOR',  levelName: 'Senior' },
    { levelCode: 'TOP',     levelName: 'Top Management' },
  ];
  for (const dl of desigLevels) {
    await prisma.designationLevel.upsert({ where: { levelCode: dl.levelCode }, update: {}, create: dl });
  }
  console.log(`Seeded ${desigLevels.length} DesignationLevel rows`);

  // ── RecruitmentApprovalMatrix (2 entries) ──────────────────────────────────
  const recApproval = [
    { matrixCode: 'RA_SEL1', process: 'Selection', approvalLevel: 1, approverType: 'Employee', approverId: interviewerId, sequence: 1, departmentId: deptId, designationId: desigId },
    { matrixCode: 'RA_OFR1', process: 'Offer',     approvalLevel: 1, approverType: 'Employee', approverId: interviewerId, sequence: 1, departmentId: deptId, designationId: desigId },
  ];
  for (const ra of recApproval) {
    const existing = await prisma.recruitmentApprovalMatrix.findFirst({ where: { matrixCode: ra.matrixCode } });
    if (!existing) await prisma.recruitmentApprovalMatrix.create({ data: ra });
  }
  console.log(`Seeded ${recApproval.length} RecruitmentApprovalMatrix rows`);

  // ── JoiningApprovalMatrix (2 entries) ───────────────────────────────────────
  const desigLevelJunior = await prisma.designationLevel.findUnique({ where: { levelCode: 'JUNIOR' } });
  const desigLevelMiddle = await prisma.designationLevel.findUnique({ where: { levelCode: 'MIDDLE' } });
  const joinApproval = [
    { matrixCode: 'JA_J1', designationLevelId: desigLevelJunior!.id, approvalLevel: 1, approverId: interviewerId, sequence: 1, departmentId: deptId },
    { matrixCode: 'JA_M1', designationLevelId: desigLevelMiddle!.id, approvalLevel: 1, approverId: interviewerId, sequence: 1, departmentId: deptId },
  ];
  for (const ja of joinApproval) {
    const existing = await prisma.joiningApprovalMatrix.findFirst({ where: { matrixCode: ja.matrixCode } });
    if (!existing) await prisma.joiningApprovalMatrix.create({ data: ja });
  }
  console.log(`Seeded ${joinApproval.length} JoiningApprovalMatrix rows`);

  // ── OtherJoiningDocType (3 types) ───────────────────────────────────────────
  const otherDocTypes = [
    { docCode: 'MED_CERT',  docName: 'Medical Fitness Certificate', mandatory: false },
    { docCode: 'REL_LET',  docName: 'Relieving Letter (Previous)', mandatory: true  },
    { docCode: 'BANK_PROOF', docName: 'Bank Account Proof',         mandatory: true  },
  ];
  for (const o of otherDocTypes) {
    await prisma.otherJoiningDocType.upsert({ where: { docCode: o.docCode }, update: {}, create: o });
  }
  console.log(`Seeded ${otherDocTypes.length} OtherJoiningDocType rows`);
  const odtMed = await prisma.otherJoiningDocType.findUnique({ where: { docCode: 'MED_CERT' } });
  const odtRel = await prisma.otherJoiningDocType.findUnique({ where: { docCode: 'REL_LET' } });

  // ── InternshipPolicy (1 policy) ─────────────────────────────────────────────
  await prisma.internshipPolicy.upsert({
    where: { policyCode: 'STD_INT' },
    update: {},
    create: {
      policyCode: 'STD_INT',
      policyName: 'Standard Internship Policy',
      stipendApplicable: true,
      defaultStipendAmount: 15000,
      stipendFrequency: 'Monthly',
      allowancesApplicable: false,
      isActive: true,
    },
  });
  console.log('Seeded InternshipPolicy (1)');
  const internPolicy = await prisma.internshipPolicy.findUnique({ where: { policyCode: 'STD_INT' } });

  // ── JobPosting (2 postings) ────────────────────────────────────────────────
  const jp1 = await prisma.jobPosting.upsert({
    where: { id: 1 },
    update: {},
    create: { title: 'Senior Software Engineer', departmentId: deptId, designationId: desigId, vacancies: 3, employmentType: 'Full-time', minExperienceYears: 5, maxExperienceYears: 10, minSalary: 800000, maxSalary: 1500000, status: 'Open', createdByUserId: userId },
  });
  const jp2 = await prisma.jobPosting.upsert({
    where: { id: 2 },
    update: {},
    create: { title: 'HR Executive', departmentId: 2, designationId: 2, vacancies: 1, employmentType: 'Full-time', minExperienceYears: 2, maxExperienceYears: 5, minSalary: 400000, maxSalary: 600000, status: 'Open', createdByUserId: userId },
  });
  console.log('Seeded JobPosting (2)');

  // ════════════════════════════════════════════════════════════════════════════
  // PART B: Candidate 1 — Full Lifecycle (JOINED → Employee Created)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- Part B: Candidate 1 — Full Lifecycle ---');

  const c1Email = 'arun.sharma.seed@example.com';
  let c1 = await prisma.candidate.findFirst({ where: { email: c1Email } });
  if (!c1) {
    c1 = await prisma.candidate.create({
      data: {
        applicationNo: 'APP-2026-SEED-01',
        applicantDate: new Date('2026-08-01'),
        title: 'Mr.',
        firstName: 'Arun',
        lastName: 'Sharma',
        email: c1Email,
        mobile: '9876501001',
        dateOfBirth: new Date('1995-03-15'),
        aadhaar: '123456789012',
        departmentId: deptId,
        designationId: desigId,
        jobPostingId: jp1.id,
        sourceChannelId: chNaukri,
        currentStatusId: sEmpCreated,
        createdById: userId,
        referenceComments: 'Strong candidate from Naukri — 7 years experience.',
      },
    });
  }
  console.log(`Candidate 1: ${c1.applicationNo} — ${c1.firstName} ${c1.lastName} (ID: ${c1.id})`);

  // CandidateDetail
  await prisma.candidateDetail.upsert({
    where: { candidateId: c1.id },
    update: {},
    create: {
      candidateId: c1.id,
      gender: 'Male',
      nationality: 'Indian',
      religion: 'Hindu',
      bloodGroup: 'B+',
      maritalStatus: 'Married',
      communicationAddress: '123 MG Road, Bangalore, Karnataka 560001',
      permanentAddress: '123 MG Road, Bangalore, Karnataka 560001',
      languages: 'Hindi, English, Kannada',
      spouseName: 'Priya Sharma',
      dependents: '[]',
      references: '[{"name":"Ravi Kumar","mobile":"9876543210"},{"name":"Sneha Reddy","mobile":"9876543211"}]',
    },
  });
  console.log('  + CandidateDetail');

  // Activity Logs (full history)
  const c1Activities = [
    { action: 'Candidate registered via Naukri', fromStatus: null, toStatus: 'NEW', createdAt: new Date('2026-08-01T10:00:00') },
    { action: 'Status changed to Screening', fromStatus: 'NEW', toStatus: 'SCREENING', createdAt: new Date('2026-08-02T09:00:00') },
    { action: 'Call interview scheduled — Connected-Interested', fromStatus: 'SCREENING', toStatus: 'CALL_INTERVIEW', createdAt: new Date('2026-08-03T14:00:00') },
    { action: 'Interview L1 scheduled', fromStatus: 'CALL_INTERVIEW', toStatus: 'INTERVIEW_SCHEDULED', createdAt: new Date('2026-08-05T10:00:00') },
    { action: 'Interview L1 completed — Pass', fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_LEVEL_1', createdAt: new Date('2026-08-07T15:00:00') },
    { action: 'Interview L2 completed — Pass', fromStatus: 'INTERVIEW_LEVEL_1', toStatus: 'INTERVIEW_LEVEL_2', createdAt: new Date('2026-08-10T15:00:00') },
    { action: 'Interview L3 completed — Pass', fromStatus: 'INTERVIEW_LEVEL_2', toStatus: 'INTERVIEW_LEVEL_3', createdAt: new Date('2026-08-12T15:00:00') },
    { action: 'Document verification completed', fromStatus: 'INTERVIEW_LEVEL_3', toStatus: 'DOCUMENT_VERIFICATION', createdAt: new Date('2026-08-13T10:00:00') },
    { action: 'Final approval granted', fromStatus: 'DOCUMENT_VERIFICATION', toStatus: 'FINAL_APPROVAL', createdAt: new Date('2026-08-14T11:00:00') },
    { action: 'Offer letter generated', fromStatus: 'FINAL_APPROVAL', toStatus: 'OFFER_GENERATED', createdAt: new Date('2026-08-15T10:00:00') },
    { action: 'Offer letter sent to candidate', fromStatus: 'OFFER_GENERATED', toStatus: 'OFFER_SENT', createdAt: new Date('2026-08-15T12:00:00') },
    { action: 'Offer accepted via portal', fromStatus: 'OFFER_SENT', toStatus: 'OFFER_ACCEPTED', createdAt: new Date('2026-08-16T09:00:00') },
    { action: 'Joining record created', fromStatus: 'OFFER_ACCEPTED', toStatus: 'JOINING_PENDING', createdAt: new Date('2026-08-17T10:00:00') },
    { action: 'Joining approved', fromStatus: 'JOINING_PENDING', toStatus: 'JOINING_APPROVAL', createdAt: new Date('2026-08-18T14:00:00') },
    { action: 'Candidate joined', fromStatus: 'JOINING_APPROVAL', toStatus: 'JOINED', createdAt: new Date('2026-09-01T09:00:00') },
    { action: 'Employee record created — KUN-2026-SEED1', fromStatus: 'JOINED', toStatus: 'EMPLOYEE_CREATED', createdAt: new Date('2026-09-01T09:30:00') },
  ];
  for (const a of c1Activities) {
    const existing = await prisma.candidateActivityLog.findFirst({ where: { candidateId: c1.id, action: a.action } });
    if (!existing) await prisma.candidateActivityLog.create({ data: { candidateId: c1.id, ...a, performedById: userId } });
  }
  console.log(`  + ${c1Activities.length} Activity Logs`);

  // Call Interview
  const c1Call = await prisma.callInterview.findFirst({ where: { candidateId: c1.id } });
  if (!c1Call) {
    await prisma.callInterview.create({
      data: {
        candidateId: c1.id,
        recruiterId: interviewerId,
        callDate: new Date('2026-08-03'),
        callTime: '14:00',
        callOutcome: 'Connected-Interested',
        candidateInterested: true,
        expectedSalary: 1200000,
        noticePeriod: '30 days',
        availableJoiningDate: new Date('2026-09-01'),
        remarks: 'Candidate is very interested. Expected salary 12L. 30 days notice.',
        nextAction: 'Schedule L1 interview',
      },
    });
  }
  console.log('  + Call Interview');

  // Interview Schedule L1 + Evaluation + Summary
  const c1IntL1 = await prisma.interviewSchedule.findFirst({ where: { candidateId: c1.id, interviewLevelId: l1 } });
  if (!c1IntL1) {
    const intL1 = await prisma.interviewSchedule.create({
      data: {
        candidateId: c1.id,
        interviewLevelId: l1,
        interviewTypeId: tHR,
        interviewerId: interviewerId,
        scheduledDate: new Date('2026-08-07'),
        startTime: '10:00',
        endTime: '11:00',
        mode: 'Online',
        locationOrLink: 'https://meet.google.com/abc-l1-seed',
        status: 'Completed',
      },
    });
    // Evaluations
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL1.id, criteriaId: critComm!.id, score: 8, maxScore: 10, remarks: 'Excellent communication', submittedById: interviewerId, submittedAt: new Date('2026-08-07T11:00:00') } });
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL1.id, criteriaId: cultCult!.id, score: 9, maxScore: 10, remarks: 'Great culture fit', submittedById: interviewerId, submittedAt: new Date('2026-08-07T11:00:00') } });
    // Summary
    await prisma.interviewEvaluationSummary.create({
      data: { scheduleId: intL1.id, totalScore: 17, weightedScore: 85, result: 'Pass', recommendation: 'Next Level', strengths: 'Communication, culture fit', weaknesses: 'None significant', finalRemarks: 'Proceed to L2' },
    });
  }
  console.log('  + Interview L1 + Evaluations + Summary');

  // Interview Schedule L2 + Evaluation + Summary
  const c1IntL2 = await prisma.interviewSchedule.findFirst({ where: { candidateId: c1.id, interviewLevelId: l2 } });
  if (!c1IntL2) {
    const intL2 = await prisma.interviewSchedule.create({
      data: {
        candidateId: c1.id,
        interviewLevelId: l2,
        interviewTypeId: tTech,
        interviewerId: interviewerId,
        scheduledDate: new Date('2026-08-10'),
        startTime: '14:00',
        endTime: '15:30',
        mode: 'Online',
        locationOrLink: 'https://meet.google.com/abc-l2-seed',
        status: 'Completed',
      },
    });
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL2.id, criteriaId: critTech!.id, score: 8, maxScore: 10, remarks: 'Strong technical skills', submittedById: interviewerId, submittedAt: new Date('2026-08-10T15:30:00') } });
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL2.id, criteriaId: critProb!.id, score: 7, maxScore: 10, remarks: 'Good problem solving', submittedById: interviewerId, submittedAt: new Date('2026-08-10T15:30:00') } });
    await prisma.interviewEvaluationSummary.create({
      data: { scheduleId: intL2.id, totalScore: 15, weightedScore: 78, result: 'Pass', recommendation: 'Next Level', strengths: 'Technical depth', weaknesses: 'Could improve system design', finalRemarks: 'Proceed to L3' },
    });
  }
  console.log('  + Interview L2 + Evaluations + Summary');

  // Interview Schedule L3 + Evaluation + Summary
  const c1IntL3 = await prisma.interviewSchedule.findFirst({ where: { candidateId: c1.id, interviewLevelId: l3 } });
  if (!c1IntL3) {
    const intL3 = await prisma.interviewSchedule.create({
      data: {
        candidateId: c1.id,
        interviewLevelId: l3,
        interviewTypeId: tMgr,
        interviewerId: interviewerId,
        scheduledDate: new Date('2026-08-12'),
        startTime: '11:00',
        endTime: '12:00',
        mode: 'In-person',
        locationOrLink: 'KUN Aerospace — Conference Room A',
        status: 'Completed',
      },
    });
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL3.id, criteriaId: critLead!.id, score: 8, maxScore: 10, remarks: 'Good leadership potential', submittedById: interviewerId, submittedAt: new Date('2026-08-12T12:00:00') } });
    await prisma.interviewEvaluation.create({ data: { scheduleId: intL3.id, criteriaId: critDomain!.id, score: 9, maxScore: 10, remarks: 'Excellent domain knowledge', submittedById: interviewerId, submittedAt: new Date('2026-08-12T12:00:00') } });
    await prisma.interviewEvaluationSummary.create({
      data: { scheduleId: intL3.id, totalScore: 17, weightedScore: 87, result: 'Pass', recommendation: 'Select', strengths: 'Leadership, domain expertise', weaknesses: 'None', finalRemarks: 'Strong candidate — recommend selection' },
    });
  }
  console.log('  + Interview L3 + Evaluations + Summary');

  // Documents (6 documents — all verified)
  const c1Docs = [
    { documentTypeId: dtResume!.id,   fileName: 'arun_resume.pdf',     fileUrl: '/uploads/seed/arun_resume.pdf',     status: 'Verified', remarks: 'Resume verified' },
    { documentTypeId: dtAadhaar!.id,  fileName: 'arun_aadhaar.pdf',    fileUrl: '/uploads/seed/arun_aadhaar.pdf',    status: 'Verified', remarks: 'Aadhaar verified' },
    { documentTypeId: dtPan!.id,      fileName: 'arun_pan.pdf',       fileUrl: '/uploads/seed/arun_pan.pdf',       status: 'Verified', remarks: 'PAN verified' },
    { documentTypeId: dtEdu!.id,      fileName: 'arun_degree.pdf',    fileUrl: '/uploads/seed/arun_degree.pdf',    status: 'Verified', remarks: 'Degree verified' },
    { documentTypeId: dtRelieve!.id,  fileName: 'arun_relieving.pdf',  fileUrl: '/uploads/seed/arun_relieving.pdf',  status: 'Verified', remarks: 'Relieving letter verified' },
    { documentTypeId: dtSalary!.id,   fileName: 'arun_salary_slips.pdf', fileUrl: '/uploads/seed/arun_salary_slips.pdf', status: 'Verified', remarks: 'Salary slips verified' },
  ];
  for (const d of c1Docs) {
    const existing = await prisma.candidateDocument.findFirst({ where: { candidateId: c1.id, documentTypeId: d.documentTypeId } });
    if (!existing) await prisma.candidateDocument.create({ data: { candidateId: c1.id, ...d, verifiedById: interviewerId, verifiedAt: new Date('2026-08-13') } });
  }
  console.log(`  + ${c1Docs.length} Documents (all Verified)`);

  // BGV (6 steps — all completed)
  const c1Bgvs = [
    { bgvStepId: bgv1, status: 'Completed', contactName: 'HR — Tech Corp', contactPhone: '9876543201', outcome: 'Documents verified successfully', performedAt: new Date('2026-08-20') },
    { bgvStepId: bgv2, status: 'Completed', contactName: 'Ravi Kumar', contactPhone: '9876543210', outcome: 'Positive feedback', performedAt: new Date('2026-08-21') },
    { bgvStepId: bgv3, status: 'Completed', contactName: 'Bangalore University', contactPhone: '9876543202', outcome: 'Degree verified', performedAt: new Date('2026-08-22') },
    { bgvStepId: bgv4, status: 'Completed', contactName: 'Tech Corp HR', contactPhone: '9876543203', outcome: 'Employment confirmed — 7 years', performedAt: new Date('2026-08-23') },
    { bgvStepId: bgv5, status: 'Completed', contactName: 'Neighbor', contactPhone: '9876543204', outcome: 'Address verified', performedAt: new Date('2026-08-24') },
    { bgvStepId: bgv6, status: 'Completed', contactName: 'Police Station', contactPhone: '9876543205', outcome: 'No criminal record', performedAt: new Date('2026-08-25') },
  ];
  for (const b of c1Bgvs) {
    const existing = await prisma.candidateBgv.findFirst({ where: { candidateId: c1.id, bgvStepId: b.bgvStepId } });
    if (!existing) await prisma.candidateBgv.create({ data: { candidateId: c1.id, ...b, remarks: 'BGV completed successfully' } });
  }
  console.log(`  + ${c1Bgvs.length} BGV Records (all Completed)`);

  // Offer Letter (Accepted)
  const c1Offer = await prisma.offerLetter.findFirst({ where: { candidateId: c1.id } });
  if (!c1Offer) {
    await prisma.offerLetter.create({
      data: {
        candidateId: c1.id,
        offerNo: 'HRM/OFL/2026/SEED-01',
        offerTemplateId: offerTpl!.id,
        status: 'Accepted',
        proposedSalary: 1200000,
        ctc: 1400000,
        joiningDate: new Date('2026-09-01'),
        employmentType: 'Full-time',
        reportingManagerId: interviewerId,
        probationMonths: 6,
        sentAt: new Date('2026-08-15T12:00:00'),
        acceptedAt: new Date('2026-08-16T09:00:00'),
        remarks: 'Offer accepted via portal',
        createdById: userId,
      },
    });
  }
  console.log('  + Offer Letter (Accepted)');

  // Appointment Order
  const c1Appt = await prisma.appointmentOrder.findFirst({ where: { candidateId: c1.id } });
  if (!c1Appt) {
    await prisma.appointmentOrder.create({
      data: {
        candidateId: c1.id,
        apptNo: 'KAPLHR/Appt/2026/SEED-01',
        appointmentTemplateId: apptTpl!.id,
        status: 'Accepted',
        generatedPdfUrl: '/uploads/seed/appt_arun.pdf',
        sentAt: new Date('2026-08-20'),
        acceptedAt: new Date('2026-08-21'),
        remarks: 'Appointment order accepted',
      },
    });
  }
  console.log('  + Appointment Order (Accepted)');

  // CandidateJoining (Approved → Joined)
  const c1Joining = await prisma.candidateJoining.findUnique({ where: { candidateId: c1.id } });
  if (!c1Joining) {
    await prisma.candidateJoining.create({
      data: {
        candidateId: c1.id,
        offerLetterId: (await prisma.offerLetter.findFirst({ where: { candidateId: c1.id } }))?.id,
        joiningDate: new Date('2026-09-01'),
        joiningStatus: 'Joined',
        actualJoiningDate: new Date('2026-09-01'),
        approvalStatus: 'Approved',
        approverId: interviewerId,
        approvedAt: new Date('2026-08-18T14:00:00'),
        approvalRemarks: 'Approved — all checks passed',
        remarks: 'Joining completed successfully',
      },
    });
  }
  console.log('  + CandidateJoining (Joined)');

  // Checklist Items (15 items — all Received)
  const allChecklist = [clApp, clJoin, clGrat, clPf, clEsi, clIns, clAadhaar, clPan, clBank, clAcademic, clRelieving, clSalary, clPhotos, clOther, clDepAadhaar];
  for (const clId of allChecklist) {
    const existing = await prisma.candidateChecklistItem.findUnique({ where: { candidateId_checklistMasterId: { candidateId: c1.id, checklistMasterId: clId } } });
    if (!existing) await prisma.candidateChecklistItem.create({ data: { candidateId: c1.id, checklistMasterId: clId, status: 'Received', updatedById: interviewerId } });
  }
  console.log(`  + ${allChecklist.length} Checklist Items (all Received)`);

  // Other Documents
  const c1OtherDocs = [
    { otherDocTypeId: odtMed!.id, documentName: 'Medical Fitness — Apollo Hospital', fileName: 'arun_medical.pdf', filePath: '/uploads/seed/arun_medical.pdf' },
    { otherDocTypeId: odtRel!.id, documentName: 'Relieving Letter — Tech Corp', fileName: 'arun_relieving_prev.pdf', filePath: '/uploads/seed/arun_relieving_prev.pdf' },
  ];
  for (const od of c1OtherDocs) {
    const existing = await prisma.candidateOtherDocument.findFirst({ where: { candidateId: c1.id, otherDocTypeId: od.otherDocTypeId } });
    if (!existing) await prisma.candidateOtherDocument.create({ data: { candidateId: c1.id, ...od } });
  }
  console.log(`  + ${c1OtherDocs.length} Other Documents`);

  // Joining Form
  await prisma.joiningForm.upsert({
    where: { candidateId: c1.id },
    update: {},
    create: {
      candidateId: c1.id,
      applicationNo: 'APP-2026-SEED-01',
      postApplied: 'Senior Software Engineer',
      applicantName: 'Arun Sharma',
      fatherName: 'Ramesh Sharma',
      dateOfBirth: new Date('1995-03-15'),
      age: 31,
      gender: 'Male',
      nationality: 'Indian',
      religion: 'Hindu',
      communicationAddress: '123 MG Road, Bangalore, Karnataka 560001',
      permanentAddress: '123 MG Road, Bangalore, Karnataka 560001',
      experience: '7 years at Tech Corp as Senior Developer',
      languages: 'Hindi, English, Kannada',
      educationalQualification: 'B.Tech Computer Science — Bangalore University',
      technicalQualification: 'AWS Certified, Kubernetes, React, Node.js',
      maritalStatus: 'Married',
      email: c1Email,
      bloodGroup: 'B+',
      mobile: '9876501001',
      status: 'Verified',
      verifiedById: interviewerId,
      verifiedAt: new Date('2026-08-28'),
    },
  });
  console.log('  + Joining Form (Verified)');

  // Joining Report
  await prisma.joiningReport.upsert({
    where: { candidateId: c1.id },
    update: {},
    create: {
      candidateId: c1.id,
      joiningDate: new Date('2026-09-01'),
      grade: 'Senior',
      bloodGroup: 'B+',
      designationId: desigId,
      reportedTo: 'Employee 1 (Manager)',
      panNo: 'ABCDE1234F',
      presentAddress: '123 MG Road, Bangalore, Karnataka 560001',
      permanentAddress: '123 MG Road, Bangalore, Karnataka 560001',
      contactNumber: '9876501001',
      emergencyContact: 'Priya Sharma — 9876501002',
      certificatesVerifiedBy: 'HR Department',
      candidateSignatureUrl: '/uploads/seed/arun_signature.png',
      reportingAuthoritySignatureUrl: '/uploads/seed/hr_signature.png',
      status: 'Verified',
    },
  });
  console.log('  + Joining Report (Verified)');

  // Gratuity Nomination + Nominees
  const c1Gratuity = await prisma.gratuityNomination.findUnique({ where: { candidateId: c1.id } });
  if (!c1Gratuity) {
    const grat = await prisma.gratuityNomination.create({
      data: {
        candidateId: c1.id,
        employerRefNo: 'GRAT-2026-001',
        employeeName: 'Arun Sharma',
        sex: 'Male',
        religion: 'Hindu',
        maritalStatus: 'Married',
        department: 'IT Dept',
        postHeld: 'Senior Software Engineer',
        appointmentDate: new Date('2026-09-01'),
        permanentAddress: '123 MG Road, Bangalore, Karnataka 560001',
        employeeSignatureUrl: '/uploads/seed/arun_signature.png',
        employerSignatureUrl: '/uploads/seed/hr_signature.png',
        witnesses: '[{"name":"Ravi","address":"Bangalore","signatureUrl":""}]',
        status: 'Verified',
      },
    });
    await prisma.gratuityNominee.create({ data: { nominationId: grat.id, nomineeName: 'Priya Sharma', relationship: 'Spouse', age: 29, proportion: 100 } });
  }
  console.log('  + Gratuity Nomination + Nominee');

  // PF Nomination + Nominees
  const c1Pf = await prisma.pfNomination.findUnique({ where: { candidateId: c1.id } });
  if (!c1Pf) {
    const pf = await prisma.pfNomination.create({
      data: {
        candidateId: c1.id,
        employeeName: 'Arun Sharma',
        aadhaar: '123456789012',
        mobile: '9876501001',
        uan: '101234567890',
        employeeSignatureUrl: '/uploads/seed/arun_signature.png',
        status: 'Verified',
      },
    });
    await prisma.pfNominee.create({ data: { nominationId: pf.id, nomineeName: 'Priya Sharma', relationship: 'Spouse', age: 29, proportion: 100 } });
  }
  console.log('  + PF Nomination + Nominee');

  // ESI Application
  await prisma.esiApplication.upsert({
    where: { candidateId: c1.id },
    update: {},
    create: {
      candidateId: c1.id,
      applicable: true,
      ipNumber: 'ESI-2026-001',
      mobile: '9876501001',
      dateOfJoining: new Date('2026-09-01'),
      aadhaarMobile: '9876501001',
      aadhaar: '123456789012',
      dateOfBirth: new Date('1995-03-15'),
      presentAddress: '123 MG Road, Bangalore, Karnataka 560001',
      nomineeDetails: '{"name":"Priya Sharma","relationship":"Spouse"}',
      bankIfsc: 'HDFC0001234',
      bankAccount: '12345678901',
      status: 'Verified',
    },
  });
  console.log('  + ESI Application (Verified)');

  // Insurance Form
  await prisma.insuranceForm.upsert({
    where: { candidateId: c1.id },
    update: {},
    create: {
      candidateId: c1.id,
      employeeName: 'Arun Sharma',
      employeeId: null,
      policyNo: 'POL-2026-001',
      provider: 'Star Health Insurance',
      coverageType: 'Family Floater',
      coverageAmount: 500000,
      premiumAmount: 15000,
      nomineeName: 'Priya Sharma',
      nomineeRelationship: 'Spouse',
      nomineeAge: 29,
      nomineeAddress: '123 MG Road, Bangalore, Karnataka 560001',
      dependentsCovered: '[{"name":"Priya Sharma","aadhaar":"123456789013"}]',
      employeeSignatureUrl: '/uploads/seed/arun_signature.png',
      hrVerificationUrl: '/uploads/seed/hr_verification.png',
      status: 'Verified',
    },
  });
  console.log('  + Insurance Form (Verified)');

  // Communication Log (5 emails)
  const c1Comms = [
    { eventType: 'interview_scheduled', toEmail: c1Email, subject: 'Interview Scheduled — KUN Aerospace', body: 'Dear Arun, your interview has been scheduled.', status: 'Sent', sentAt: new Date('2026-08-05T10:00:00') },
    { eventType: 'offer_sent',          toEmail: c1Email, subject: 'Offer Letter from KUN Aerospace', body: 'Dear Arun, we are pleased to offer you...', status: 'Sent', sentAt: new Date('2026-08-15T12:00:00') },
    { eventType: 'offer_accepted',      toEmail: c1Email, subject: 'Offer Accepted — Confirmation', body: 'Dear Arun, thank you for accepting the offer.', status: 'Sent', sentAt: new Date('2026-08-16T09:00:00') },
    { eventType: 'joining',             toEmail: c1Email, subject: 'Joining Instructions — KUN Aerospace', body: 'Dear Arun, your joining date is Sep 1, 2026.', status: 'Sent', sentAt: new Date('2026-08-20T10:00:00') },
    { eventType: 'welcome',             toEmail: c1Email, subject: 'Welcome to KUN Aerospace', body: 'Dear Arun, welcome aboard!', status: 'Sent', sentAt: new Date('2026-09-01T09:00:00') },
  ];
  for (const c of c1Comms) {
    const existing = await prisma.communicationLog.findFirst({ where: { candidateId: c1.id, eventType: c.eventType } });
    if (!existing) await prisma.communicationLog.create({ data: { candidateId: c1.id, ...c, createdById: userId } });
  }
  console.log(`  + ${c1Comms.length} Communication Logs`);

  // Portal Token + Messages
  const c1Token = await prisma.candidatePortalToken.findFirst({ where: { candidateId: c1.id } });
  if (!c1Token) {
    await prisma.candidatePortalToken.create({
      data: {
        candidateId: c1.id,
        token: 'seed-token-arun-sharma-2026-' + Date.now(),
        expiresAt: new Date('2026-12-31'),
        lastUsedAt: new Date('2026-08-16T09:00:00'),
      },
    });
  }
  console.log('  + Portal Token');

  const c1Messages = [
    { fromRole: 'candidate', fromName: 'Arun Sharma', message: 'Hello HR, I have accepted the offer. Looking forward to joining!', isRead: true, createdAt: new Date('2026-08-16T09:05:00') },
    { fromRole: 'hr', fromName: 'HR Team', message: 'Hi Arun, congratulations! Please complete the joining formalities via portal.', isRead: true, createdAt: new Date('2026-08-16T10:00:00') },
    { fromRole: 'candidate', fromName: 'Arun Sharma', message: 'I have uploaded all documents. Please review.', isRead: true, createdAt: new Date('2026-08-20T14:00:00') },
  ];
  for (const m of c1Messages) {
    const existing = await prisma.candidatePortalMessage.findFirst({ where: { candidateId: c1.id, message: m.message } });
    if (!existing) await prisma.candidatePortalMessage.create({ data: { candidateId: c1.id, ...m } });
  }
  console.log(`  + ${c1Messages.length} Portal Messages`);

  // ════════════════════════════════════════════════════════════════════════════
  // PART C: Candidate 2 — Mid-Pipeline (Interview Scheduled, not yet evaluated)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- Part C: Candidate 2 — Mid-Pipeline ---');

  const c2Email = 'sneha.reddy.seed@example.com';
  let c2 = await prisma.candidate.findFirst({ where: { email: c2Email } });
  if (!c2) {
    c2 = await prisma.candidate.create({
      data: {
        applicationNo: 'APP-2026-SEED-02',
        applicantDate: new Date('2026-08-20'),
        title: 'Ms.',
        firstName: 'Sneha',
        lastName: 'Reddy',
        email: c2Email,
        mobile: '9876502002',
        dateOfBirth: new Date('1998-07-22'),
        aadhaar: '987654321098',
        departmentId: 2,  // HR
        designationId: 2,  // HR Manager
        jobPostingId: jp2.id,
        sourceChannelId: chLinkedIn,
        currentStatusId: sIntSched,
        createdById: userId,
        referenceComments: 'Candidate from LinkedIn — 3 years HR experience.',
      },
    });
  }
  console.log(`Candidate 2: ${c2.applicationNo} — ${c2.firstName} ${c2.lastName} (ID: ${c2.id})`);

  // CandidateDetail
  await prisma.candidateDetail.upsert({
    where: { candidateId: c2.id },
    update: {},
    create: {
      candidateId: c2.id,
      gender: 'Female',
      nationality: 'Indian',
      religion: 'Hindu',
      bloodGroup: 'O+',
      maritalStatus: 'Single',
      communicationAddress: '456 Brigade Road, Bangalore, Karnataka 560025',
      permanentAddress: '456 Brigade Road, Bangalore, Karnataka 560025',
      languages: 'Telugu, English, Hindi',
      spouseName: null,
      dependents: '[]',
      references: '[{"name":"Anitha Rao","mobile":"9876543220"}]',
    },
  });
  console.log('  + CandidateDetail');

  // Activity Logs
  const c2Activities = [
    { action: 'Candidate registered via LinkedIn', fromStatus: null, toStatus: 'NEW', createdAt: new Date('2026-08-20T10:00:00') },
    { action: 'Status changed to Screening', fromStatus: 'NEW', toStatus: 'SCREENING', createdAt: new Date('2026-08-21T09:00:00') },
    { action: 'Call interview scheduled — Connected-Interested', fromStatus: 'SCREENING', toStatus: 'CALL_INTERVIEW', createdAt: new Date('2026-08-22T11:00:00') },
    { action: 'Interview L1 scheduled', fromStatus: 'CALL_INTERVIEW', toStatus: 'INTERVIEW_SCHEDULED', createdAt: new Date('2026-08-25T10:00:00') },
  ];
  for (const a of c2Activities) {
    const existing = await prisma.candidateActivityLog.findFirst({ where: { candidateId: c2.id, action: a.action } });
    if (!existing) await prisma.candidateActivityLog.create({ data: { candidateId: c2.id, ...a, performedById: userId } });
  }
  console.log(`  + ${c2Activities.length} Activity Logs`);

  // Call Interview
  const c2Call = await prisma.callInterview.findFirst({ where: { candidateId: c2.id } });
  if (!c2Call) {
    await prisma.callInterview.create({
      data: {
        candidateId: c2.id,
        recruiterId: interviewerId,
        callDate: new Date('2026-08-22'),
        callTime: '11:00',
        callOutcome: 'Connected-Interested',
        candidateInterested: true,
        expectedSalary: 500000,
        noticePeriod: '15 days',
        availableJoiningDate: new Date('2026-09-15'),
        remarks: 'Candidate is interested. 15 days notice. Expected 5L.',
        nextAction: 'Schedule L1 HR interview',
      },
    });
  }
  console.log('  + Call Interview');

  // Interview Schedule L1 (Scheduled — not yet evaluated)
  const c2IntL1 = await prisma.interviewSchedule.findFirst({ where: { candidateId: c2.id } });
  if (!c2IntL1) {
    await prisma.interviewSchedule.create({
      data: {
        candidateId: c2.id,
        interviewLevelId: l1,
        interviewTypeId: tHR,
        interviewerId: interviewerId,
        scheduledDate: new Date('2026-08-28'),
        startTime: '14:00',
        endTime: '15:00',
        mode: 'Online',
        locationOrLink: 'https://meet.google.com/def-l1-seed2',
        status: 'Scheduled',
      },
    });
  }
  console.log('  + Interview L1 (Scheduled — pending evaluation)');

  // Documents (3 uploaded — 2 verified, 1 pending)
  const c2Docs = [
    { documentTypeId: dtResume!.id,  fileName: 'sneha_resume.pdf',  fileUrl: '/uploads/seed/sneha_resume.pdf',  status: 'Verified', remarks: 'Resume verified' },
    { documentTypeId: dtAadhaar!.id, fileName: 'sneha_aadhaar.pdf', fileUrl: '/uploads/seed/sneha_aadhaar.pdf', status: 'Verified', remarks: 'Aadhaar verified' },
    { documentTypeId: dtPan!.id,     fileName: 'sneha_pan.pdf',     fileUrl: '/uploads/seed/sneha_pan.pdf',     status: 'Uploaded', remarks: 'Pending verification' },
  ];
  for (const d of c2Docs) {
    const existing = await prisma.candidateDocument.findFirst({ where: { candidateId: c2.id, documentTypeId: d.documentTypeId } });
    if (!existing) {
      const data: any = { candidateId: c2.id, ...d };
      if (d.status === 'Verified') { data.verifiedById = interviewerId; data.verifiedAt = new Date('2026-08-24'); }
      await prisma.candidateDocument.create({ data });
    }
  }
  console.log(`  + ${c2Docs.length} Documents (2 Verified, 1 Pending)`);

  // BGV (2 steps — 1 in progress, 1 not initiated)
  const c2Bgvs = [
    { bgvStepId: bgv1, status: 'In Progress', contactName: 'HR — Info Ltd', contactPhone: '9876543301', remarks: 'Document verification in progress' },
    { bgvStepId: bgv2, status: 'Not Initiated', contactName: null, contactPhone: null, remarks: 'Reference check pending' },
  ];
  for (const b of c2Bgvs) {
    const existing = await prisma.candidateBgv.findFirst({ where: { candidateId: c2.id, bgvStepId: b.bgvStepId } });
    if (!existing) await prisma.candidateBgv.create({ data: { candidateId: c2.id, ...b } });
  }
  console.log(`  + ${c2Bgvs.length} BGV Records (1 In Progress, 1 Not Initiated)`);

  // Communication Log (2 emails)
  const c2Comms = [
    { eventType: 'interview_scheduled', toEmail: c2Email, subject: 'Interview Scheduled — KUN Aerospace', body: 'Dear Sneha, your interview has been scheduled for Aug 28.', status: 'Sent', sentAt: new Date('2026-08-25T10:00:00') },
    { eventType: 'call_interview',       toEmail: c2Email, subject: 'Call Interview — KUN Aerospace', body: 'Dear Sneha, thank you for your interest in KUN Aerospace.', status: 'Sent', sentAt: new Date('2026-08-22T11:30:00') },
  ];
  for (const c of c2Comms) {
    const existing = await prisma.communicationLog.findFirst({ where: { candidateId: c2.id, eventType: c.eventType } });
    if (!existing) await prisma.communicationLog.create({ data: { candidateId: c2.id, ...c, createdById: userId } });
  }
  console.log(`  + ${c2Comms.length} Communication Logs`);

  // Portal Token + 1 Message
  const c2Token = await prisma.candidatePortalToken.findFirst({ where: { candidateId: c2.id } });
  if (!c2Token) {
    await prisma.candidatePortalToken.create({
      data: {
        candidateId: c2.id,
        token: 'seed-token-sneha-reddy-2026-' + Date.now(),
        expiresAt: new Date('2026-12-31'),
        lastUsedAt: new Date('2026-08-25T10:00:00'),
      },
    });
  }
  console.log('  + Portal Token');

  const c2Messages = [
    { fromRole: 'candidate', fromName: 'Sneha Reddy', message: 'Hello HR, I have received the interview schedule. Thank you!', isRead: false, createdAt: new Date('2026-08-25T10:30:00') },
  ];
  for (const m of c2Messages) {
    const existing = await prisma.candidatePortalMessage.findFirst({ where: { candidateId: c2.id, message: m.message } });
    if (!existing) await prisma.candidatePortalMessage.create({ data: { candidateId: c2.id, ...m } });
  }
  console.log(`  + ${c2Messages.length} Portal Message`);

  // ════════════════════════════════════════════════════════════════════════════
  // PART D: Internship Candidate (bonus — covers BRD §6.2)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- Part D: Internship Candidate (Bonus) ---');

  const c3Email = 'karan.intern.seed@example.com';
  let c3 = await prisma.candidate.findFirst({ where: { email: c3Email } });
  if (!c3) {
    c3 = await prisma.candidate.create({
      data: {
        applicationNo: 'APP-2026-SEED-03',
        applicantDate: new Date('2026-08-15'),
        title: 'Mr.',
        firstName: 'Karan',
        lastName: 'Patel',
        email: c3Email,
        mobile: '9876503003',
        dateOfBirth: new Date('2003-11-10'),
        aadhaar: '567890123456',
        departmentId: deptId,
        designationId: desigId,
        jobPostingId: jp1.id,
        sourceChannelId: chReferral,
        currentStatusId: sNew,
        createdById: userId,
        referenceComments: 'Internship candidate — referred by Employee 1.',
      },
    });
  }
  console.log(`Candidate 3 (Intern): ${c3.applicationNo} — ${c3.firstName} ${c3.lastName} (ID: ${c3.id})`);

  // Internship Record
  const c3Intern = await prisma.internship.findFirst({ where: { candidateId: c3.id } });
  if (!c3Intern) {
    await prisma.internship.create({
      data: {
        internId: 'INT-2026-001',
        candidateId: c3.id,
        college: 'Bangalore Institute of Technology',
        regNo: 'BIT2023CS045',
        course: 'B.E. Computer Science',
        departmentId: deptId,
        mentorId: mentorId,
        trainingStart: new Date('2026-09-01'),
        trainingEnd: new Date('2027-03-01'),
        stipend: 15000,
        policyId: internPolicy?.id,
        status: 'Active',
      },
    });
  }
  console.log('  + Internship Record (Active)');

  // Activity Log
  const c3Activities = [
    { action: 'Internship candidate registered via Referral', fromStatus: null, toStatus: 'NEW', createdAt: new Date('2026-08-15T10:00:00') },
    { action: 'Internship record created — 6 months', fromStatus: 'NEW', toStatus: 'NEW', createdAt: new Date('2026-08-16T10:00:00') },
  ];
  for (const a of c3Activities) {
    const existing = await prisma.candidateActivityLog.findFirst({ where: { candidateId: c3.id, action: a.action } });
    if (!existing) await prisma.candidateActivityLog.create({ data: { candidateId: c3.id, ...a, performedById: userId } });
  }
  console.log(`  + ${c3Activities.length} Activity Logs`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('SEED COMPLETE — Summary');
  console.log('='.repeat(60));
  console.log('Masters seeded:');
  console.log('  - InterviewCriteria: 6');
  console.log('  - InterviewScoreConfig: 6');
  console.log('  - InterviewPanel: 3');
  console.log('  - InterviewProcess: 1 (+ 3 levels)');
  console.log('  - DocumentType: 6');
  console.log('  - EmailTemplate: 5');
  console.log('  - OfferTemplate: 2');
  console.log('  - AppointmentTemplate: 1');
  console.log('  - DesignationLevel: 4');
  console.log('  - RecruitmentApprovalMatrix: 2');
  console.log('  - JoiningApprovalMatrix: 2');
  console.log('  - OtherJoiningDocType: 3');
  console.log('  - InternshipPolicy: 1');
  console.log('  - JobPosting: 2');
  console.log('');
  console.log('Candidate 1 — Arun Sharma (Full Lifecycle):');
  console.log('  - Status: EMPLOYEE_CREATED');
  console.log('  - 3 Interviews (L1, L2, L3) with evaluations + summaries');
  console.log('  - 6 Documents (all Verified)');
  console.log('  - 6 BGV Records (all Completed)');
  console.log('  - Offer Letter (Accepted)');
  console.log('  - Appointment Order (Accepted)');
  console.log('  - Joining (Joined) + 15 Checklist Items (Received)');
  console.log('  - Joining Form + Joining Report (Verified)');
  console.log('  - Gratuity + PF + ESI + Insurance Forms (Verified)');
  console.log('  - 5 Communication Logs');
  console.log('  - Portal Token + 3 Messages');
  console.log('  - 2 Other Documents');
  console.log('');
  console.log('Candidate 2 — Sneha Reddy (Mid-Pipeline):');
  console.log('  - Status: INTERVIEW_SCHEDULED');
  console.log('  - 1 Interview (L1 Scheduled — pending evaluation)');
  console.log('  - 3 Documents (2 Verified, 1 Pending)');
  console.log('  - 2 BGV Records (1 In Progress, 1 Not Initiated)');
  console.log('  - 2 Communication Logs');
  console.log('  - Portal Token + 1 Message');
  console.log('');
  console.log('Candidate 3 — Karan Patel (Internship):');
  console.log('  - Status: NEW');
  console.log('  - Internship Record (Active — 6 months)');
  console.log('  - 2 Activity Logs');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
