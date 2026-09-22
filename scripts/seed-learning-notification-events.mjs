/**
 * Seeds NotificationEvent + NotificationTemplate rows for the Learning module
 * (BRD §7-8, §20-22, §36-37). Idempotent: events upsert on (companyId, code);
 * templates upsert on (companyId, code, versionNo=1) and refresh on re-run.
 *
 *   node scripts/seed-learning-notification-events.mjs
 *
 * Events registered:
 *   TNA_SUBMITTED, TNA_APPROVED, TNA_REJECTED,
 *   NOMINATION_SUBMITTED, NOMINATION_APPROVED, NOMINATION_REJECTED,
 *   TRAINING_SCHEDULED, TRAINING_REMINDER, TRAINING_COMPLETED,
 *   FEEDBACK_PENDING, CERT_EXPIRING
 */

import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, '');
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const EFFECTIVE_FROM = new Date(Date.UTC(2026, 0, 1));

const SIGN = '\n\nRegards,\n{{Company.Name}}\nSupport: {{System.SupportEmail}}';

const EVENTS = [
  {
    code: 'TNA_SUBMITTED', name: 'Training need submitted', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'ROLE:hr-admin,ROLE:company-admin',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Request.Source', 'Request.Priority', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Training need raised: {{Request.Source|default:Skill Gap}} — {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training need has been raised and is awaiting review.\n\nEmployee : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\nSource   : {{Request.Source|default:Skill Gap}}\nPriority : {{Request.Priority|default:Medium}}\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TNA_APPROVED', name: 'Training need approved', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Training need approved — {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training need for {{Employee.FullName|default:the employee}} has been approved and will be considered in the next training plan.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TNA_REJECTED', name: 'Training need rejected', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Training need rejected — {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training need for {{Employee.FullName|default:the employee}} has been rejected.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'NOMINATION_SUBMITTED', name: 'Training nomination submitted', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_MANAGER_L1,ROLE:hr-admin',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Nomination submitted: {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training nomination has been submitted for {{Employee.FullName|default:an employee}} and is awaiting approval.\n\nApprove: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'NOMINATION_APPROVED', name: 'Training nomination approved', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName'] },
    subject: 'You are nominated: training approved',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour training nomination has been approved. You will receive a schedule notification shortly.\n\nDetails: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'NOMINATION_REJECTED', name: 'Training nomination rejected', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName'] },
    subject: 'Training nomination rejected',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour training nomination has been rejected. Please contact your manager or L&D for details.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TNA_RETURNED', name: 'Training need returned for correction', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Training need returned for correction — {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training need for {{Employee.FullName|default:the employee}} has been returned for correction. Please update and resubmit.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'NOMINATION_RETURNED', name: 'Training nomination returned for correction', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_MANAGER_L1,ROLE:hr-admin',
    contextSchemaJson: { Request: {}, optional: ['Request.Id', 'Employee.FullName'] },
    subject: 'Training nomination returned for correction',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training nomination for {{Employee.FullName|default:an employee}} has been returned for correction. Please update and resubmit.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TRAINING_SCHEDULED', name: 'Training scheduled', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Training.Date', 'Training.Time', 'Training.Venue', 'Employee.FullName'] },
    subject: 'Training scheduled: {{Training.Program|default:Training}} on {{Training.Date|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nYou have been scheduled for a training session.\n\nProgram : {{Training.Program|default:—}}\nDate    : {{Training.Date|default:—}}\nTime    : {{Training.Time|default:—}}\nVenue   : {{Training.Venue|default:—}}\n\nCalendar: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TRAINING_REMINDER', name: 'Training reminder', moduleCode: 'TRDV', category: 'REMINDER', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Training.Date', 'Training.Time', 'Training.Venue', 'Employee.FullName'] },
    subject: 'Reminder: training tomorrow — {{Training.Program|default:Training}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nThis is a reminder that your training is scheduled for tomorrow.\n\nProgram : {{Training.Program|default:—}}\nDate    : {{Training.Date|default:—}}\nTime    : {{Training.Time|default:—}}\nVenue   : {{Training.Venue|default:—}}\n\nCalendar: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'TRAINING_COMPLETED', name: 'Training completed', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1,ROLE:hr-admin',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Training.Attendees', 'Employee.FullName'] },
    subject: 'Training completed: {{Training.Program|default:Training}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA training session has been marked completed.\n\nProgram   : {{Training.Program|default:—}}\nAttendees : {{Training.Attendees|default:0}}\n\nHistory: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'FEEDBACK_PENDING', name: 'Training feedback pending', moduleCode: 'TRDV', category: 'REMINDER', defaultPriority: 'LOW',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Employee.FullName'] },
    subject: 'Feedback pending: {{Training.Program|default:Training}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nPlease submit your feedback for the recently completed training.\n\nProgram : {{Training.Program|default:—}}\n\nSubmit: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'INDUCTION_ASSIGNED', name: 'Induction program assigned', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Employee.FullName'] },
    subject: 'Induction program assigned: {{Training.Program|default:Induction}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nAn induction program has been assigned to you as part of your onboarding.\n\nProgram : {{Training.Program|default:—}}\n\nDetails: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'EFFECTIVENESS_PENDING', name: 'Training effectiveness evaluation due', moduleCode: 'TRDV', category: 'REMINDER', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_MANAGER_L1,ROLE:hr-admin',
    contextSchemaJson: { Training: {}, optional: ['Training.Program', 'Employee.FullName'] },
    subject: 'Effectiveness evaluation due: {{Training.Program|default:Training}} — {{Employee.FullName|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nA post-training effectiveness evaluation is now due for {{Employee.FullName|default:an employee}}.\n\nProgram : {{Training.Program|default:—}}\n\nEvaluate: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'CERT_EXPIRING', name: 'Certification expiring', moduleCode: 'TRDV', category: 'REMINDER', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1,ROLE:hr-admin',
    contextSchemaJson: { Certificate: {}, optional: ['Certificate.Number', 'Certificate.ExpiryDate', 'Certificate.DaysToExpiry', 'Employee.FullName', 'Employee.Code'] },
    subject: 'Certification expiring in {{Certificate.DaysToExpiry|default:—}} days: {{Certificate.Number|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nThe certification {{Certificate.Number|default:—}} of {{Employee.FullName|default:—}} ({{Employee.Code|default:—}}) expires on {{Certificate.ExpiryDate|date:dd-MMM-yyyy|default:—}}, in {{Certificate.DaysToExpiry|default:—}} days.\n\nPlease arrange renewal before that date.' + SIGN,
  },
  {
    code: 'EXTERNAL_STATUS_CHANGED', name: 'External training status changed', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'ROLE:hr-admin,ROLE:company-admin',
    contextSchemaJson: { Training: {}, optional: ['Training.Title', 'Training.Status'] },
    subject: 'External training {{Training.Title|default:—}} → {{Training.Status|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nThe external training "{{Training.Title|default:—}}" status changed to {{Training.Status|default:—}}.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'PLAN_STATUS_CHANGED', name: 'Training plan status changed', moduleCode: 'TRDV', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'ROLE:hr-admin,ROLE:company-admin',
    contextSchemaJson: { Plan: {}, optional: ['Plan.Title', 'Plan.Status', 'Plan.Year'] },
    subject: 'Training plan {{Plan.Title|default:—}} → {{Plan.Status|default:—}}',
    body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nThe training plan "{{Plan.Title|default:—}}" ({{Plan.Year|default:—}}) status changed to {{Plan.Status|default:—}}.\n\nReview: {{Link.RequestDetail}}' + SIGN,
  },
];

function toHtml(text) {
  const esc = (s) => s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  return '<p>' + esc(text).split('\n\n').map((p) => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
}

try {
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, code: true } });
  let events = 0;
  let templates = 0;
  for (const company of companies) {
    for (const e of EVENTS) {
      const eventData = {
        name: e.name,
        moduleCode: e.moduleCode,
        category: e.category,
        defaultPriority: e.defaultPriority,
        defaultRecipients: e.defaultRecipients,
        contextSchemaJson: JSON.stringify(e.contextSchemaJson),
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        quietHoursExempt: false,
        digestEligible: e.category === 'REMINDER',
        retentionDays: 2920,
        isActive: true,
      };
      await prisma.notificationEvent.upsert({
        where: { companyId_code: { companyId: company.id, code: e.code } },
        update: eventData,
        create: { companyId: company.id, code: e.code, ...eventData },
      });
      events++;

      for (const channel of ['INAPP', 'EMAIL']) {
        const code = `${e.code}_${channel}`;
        const tplData = {
          name: `${e.name} (${channel === 'INAPP' ? 'in-app' : 'email'})`,
          eventCode: e.code,
          channel,
          language: 'en-IN',
          effectiveFrom: EFFECTIVE_FROM,
          effectiveTo: null,
          subject: e.subject,
          bodyText: e.body,
          bodyHtml: channel === 'EMAIL' ? toHtml(e.body) : null,
          smsText: null,
          status: 'Active',
        };
        await prisma.notificationTemplate.upsert({
          where: { companyId_code_versionNo: { companyId: company.id, code, versionNo: 1 } },
          update: tplData,
          create: { companyId: company.id, code, versionNo: 1, ...tplData },
        });
        templates++;
      }
    }
    console.log(`${company.code}: ${EVENTS.length} Learning events, ${EVENTS.length * 2} templates`);
  }
  console.log(`Done: ${events} event upserts, ${templates} template upserts across ${companies.length} companies.`);
} finally {
  await prisma.$disconnect();
}
