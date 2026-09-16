/**
 * Seeds the platform's own NotificationEvent rows (BRD §13.5 routing) and an
 * en-IN INAPP + EMAIL template (version 1) for each, for every company.
 * Idempotent: events upsert on (companyId, code); templates upsert on
 * (companyId, code, versionNo=1) and refresh their text on re-run.
 *
 *   node scripts/seed-platform-notification-events.mjs
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
const REQ_BLOCK =
  'Request number : {{Request.No}}\n' +
  'Type           : {{Request.Type|default:Request}}\n' +
  'Raised by      : {{Requester.FullName|default:—}} ({{Requester.Code|default:—}})\n' +
  'Employee       : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\n' +
  'Department     : {{Employee.Department|default:—}}';

/** eventCode → definition + templates. Recipients per §13.5; ROLE codes are this DB's Role.code values. */
const EVENTS = [
  {
    code: 'WF_PENDING_APPROVAL', name: 'Approval pending on you', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'CURRENT_APPROVERS', pushEnabled: false,
    contextSchemaJson: { Request: {}, Approver: {}, optional: ['Request.Type', 'Request.Level', 'Request.TotalLevels', 'Request.DueAt', 'Request.Amount', 'Request.EscalationTargetName', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Approval needed: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Approver}},\n\nA request is awaiting your approval at level {{Request.Level|default:1}} of {{Request.TotalLevels|default:1}}.\n\n' +
      REQ_BLOCK + '\nDue by         : {{Request.DueAt|date:dd-MMM-yyyy HH:mm|default:—}} IST\n\nOpen the request: {{Link.RequestDetail}}\n\n' +
      'This request will escalate if no action is taken by the due date.' + SIGN,
  },
  {
    code: 'WF_APPROVED', name: 'Request approved', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE', pushEnabled: false,
    contextSchemaJson: { Request: {}, Approver: {}, optional: ['Request.Type', 'Approver.Name', 'Approver.Remark', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Approved: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour request has been approved.\n\n' + REQ_BLOCK +
      '\nApproved by    : {{Approver.Name|default:—}}\nRemark         : {{Approver.Remark|default:—}}\n\nView the request: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'WF_REJECTED', name: 'Request rejected', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE', pushEnabled: false,
    contextSchemaJson: { Request: {}, Approver: {}, optional: ['Request.Type', 'Approver.Name', 'Approver.Remark', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Rejected: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour request has been rejected.\n\n' + REQ_BLOCK +
      '\nRejected by    : {{Approver.Name|default:—}}\nReason         : {{Approver.Remark|default:Not stated}}\n\nView the request: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'WF_RETURNED', name: 'Request returned for correction', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'REQUESTER', pushEnabled: false,
    contextSchemaJson: { Request: {}, Approver: {}, optional: ['Request.Type', 'Approver.Name', 'Approver.Remark', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Returned for correction: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour request has been returned to you for correction. Please review the remark, amend the request and resubmit it.\n\n' + REQ_BLOCK +
      '\nReturned by    : {{Approver.Name|default:—}}\nRemark         : {{Approver.Remark|default:Not stated}}\n\nOpen the request: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'WF_ESCALATED', name: 'Request escalated', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'URGENT',
    defaultRecipients: 'CURRENT_APPROVERS,REQUESTER', pushEnabled: false, quietHoursExempt: true,
    contextSchemaJson: { Request: {}, Escalation: {}, optional: ['Request.Type', 'Request.Level', 'Request.DueAt', 'Escalation.FromApproverName', 'Escalation.ToApproverName', 'Escalation.HopNo', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Escalated: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nThe approval SLA on this request has been breached at level {{Request.Level|default:—}} and the request has been escalated (hop {{Escalation.HopNo|default:1}}) from {{Escalation.FromApproverName|default:the late approver}} to {{Escalation.ToApproverName|default:the escalation target}}.\n\n' +
      REQ_BLOCK + '\nNew due by     : {{Request.DueAt|date:dd-MMM-yyyy HH:mm|default:—}} IST\n\nOpen the request: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'WF_ESCALATION_EXHAUSTED', name: 'Escalation chain exhausted', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'URGENT',
    defaultRecipients: 'ROLE:hr-admin,ROLE:company-admin', pushEnabled: false, quietHoursExempt: true,
    contextSchemaJson: { Request: {}, optional: ['Request.Type', 'Request.Level', 'Request.DueAt', 'Requester.FullName', 'Requester.Code', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'ACTION REQUIRED — escalation exhausted: {{Request.Title}} ({{Request.No}})',
    body:
      'Dear {{Recipient.FirstName|default:Administrator}},\n\nEvery escalation hop for this request has been used and it is still awaiting a decision at level {{Request.Level|default:—}}. Manual reassignment or a decision by an authorised approver is required.\n\n' +
      REQ_BLOCK + '\n\nOpen the request: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'WF_DELEGATION_ACTIVE', name: 'Delegation of authority active', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE',
    contextSchemaJson: { Delegation: {}, optional: ['Delegation.ScopeText', 'Delegation.Reason', 'Requester.FullName', 'Employee.FullName'] },
    subject: 'Approval delegation active: {{Requester.FullName|default:Delegator}} → {{Employee.FullName|default:Delegate}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nA delegation of approval authority is now active.\n\n' +
      'Delegator : {{Requester.FullName|default:—}} ({{Requester.Code|default:—}})\nDelegate  : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\n' +
      'From      : {{Delegation.FromDate|date:dd-MMM-yyyy}}\nTo        : {{Delegation.ToDate|date:dd-MMM-yyyy}}\nScope     : {{Delegation.ScopeText|default:All request types}}\nReason    : {{Delegation.Reason|default:—}}\n\n' +
      'Requests addressed to the delegator will appear in the delegate\'s inbox for this period.' + SIGN,
  },
  {
    code: 'EMPLOYEE_CREATED', name: 'Employee created', moduleCode: 'CORE', category: 'INFORMATIONAL', defaultPriority: 'LOW',
    defaultRecipients: 'ROLE:hr-admin', digestEligible: true,
    contextSchemaJson: { Employee: {}, optional: ['Employee.offerNo'] },
    subject: 'New employee created: {{Employee.FullName|default:—}} ({{Employee.code}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nA new employee record has been created.\n\n' +
      'Employee code : {{Employee.code}}\nSource        : {{Employee.source|default:Manual}}\nOffer no.     : {{Employee.offerNo|default:—}}\n\n' +
      'Open: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'EMPLOYEE_REHIRED', name: 'Employee rehired', moduleCode: 'CORE', category: 'INFORMATIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'ROLE:hr-admin', digestEligible: true,
    contextSchemaJson: { Employee: {}, optional: ['Employee.offerNo'] },
    subject: 'Employee rehired: {{Employee.FullName|default:—}} ({{Employee.code}})',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nA previously separated employee has rejoined and their original employee code has been reinstated.\n\n' +
      'Employee code : {{Employee.code}}\nOffer no.     : {{Employee.offerNo|default:—}}\n\n' +
      'Open: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'EMPLOYEE_STATE_CHANGED', name: 'Employee lifecycle state changed', moduleCode: 'CORE', category: 'INFORMATIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_MANAGER_L1,ROLE:hr-admin', digestEligible: true,
    contextSchemaJson: { Lifecycle: {}, optional: ['Lifecycle.reason', 'Lifecycle.referenceNo', 'Employee.FullName'] },
    subject: '{{Employee.FullName|default:Employee}}: {{Lifecycle.fromState|default:—}} → {{Lifecycle.toState}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nAn employee lifecycle state change has been recorded.\n\n' +
      'Employee      : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\nFrom state    : {{Lifecycle.fromState|default:—}}\nTo state      : {{Lifecycle.toState}}\n' +
      'Trigger       : {{Lifecycle.trigger}}\nReason        : {{Lifecycle.reason|default:—}}\nReference     : {{Lifecycle.referenceNo|default:—}}\n\n' +
      'Open: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'EMPLOYEE_JOB_CHANGED', name: 'Employee job details changed', moduleCode: 'CORE', category: 'INFORMATIONAL', defaultPriority: 'LOW',
    defaultRecipients: 'SUBJECT_MANAGER_L1,ROLE:hr-admin', digestEligible: true,
    contextSchemaJson: { Job: {}, optional: ['Job.reference', 'Employee.FullName'] },
    subject: 'Job change for {{Employee.FullName|default:employee}}: {{Job.changeReason}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nA job detail change has been recorded, effective {{Job.effectiveFrom|date:dd-MMM-yyyy}}.\n\n' +
      'Employee      : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\nChange reason : {{Job.changeReason}}\nReference     : {{Job.reference|default:—}}\n\n' +
      'Open: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'DOCUMENT_UPLOADED', name: 'Document uploaded', moduleCode: 'PLAT', category: 'INFORMATIONAL', defaultPriority: 'LOW',
    defaultRecipients: 'ROLE:hr-admin', digestEligible: true,
    contextSchemaJson: { Document: {}, optional: ['Document.FileName', 'Document.VersionNo', 'Employee.FullName', 'Employee.Code', 'Employee.Department'] },
    subject: 'Document uploaded: {{Document.TypeName}} — {{Employee.FullName|default:—}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nA document has been uploaded and is awaiting verification.\n\n' +
      'Employee      : {{Employee.FullName|default:—}} ({{Employee.Code|default:—}})\nDocument type : {{Document.TypeName}}\nFile          : {{Document.FileName|default:—}}\nVersion       : {{Document.VersionNo|default:1}}\n\n' +
      'Open: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'DOCUMENT_VERIFIED', name: 'Document verified', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE', pushEnabled: false,
    contextSchemaJson: { Document: {}, Approver: {}, optional: ['Document.ExpiryDate', 'Approver.Name', 'Employee.FullName'] },
    subject: 'Document verified: {{Document.TypeName}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour {{Document.TypeName}} has been verified by {{Approver.Name|default:HR}}.\n' +
      'Valid until: {{Document.ExpiryDate|date:dd-MMM-yyyy|default:no expiry}}\n\nOpen: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'DOCUMENT_REJECTED', name: 'Document rejected', moduleCode: 'PLAT', category: 'TRANSACTIONAL', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE', pushEnabled: false,
    contextSchemaJson: { Document: {}, Approver: {}, optional: ['Document.RejectionReason', 'Approver.Name', 'Employee.FullName'] },
    subject: 'Document rejected: {{Document.TypeName}} — action required',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour {{Document.TypeName}} could not be verified and has been rejected by {{Approver.Name|default:HR}}.\n' +
      'Reason: {{Document.RejectionReason|default:Not stated}}\n\nPlease upload a corrected copy: {{Link.RequestDetail}}' + SIGN,
  },
  {
    code: 'DOCUMENT_EXPIRY_ALERT', name: 'Document expiring', moduleCode: 'PLAT', category: 'REMINDER', defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE,SUBJECT_MANAGER_L1,ROLE:hr-admin', pushEnabled: false, digestEligible: true,
    contextSchemaJson: { Document: {}, optional: ['Employee.FullName', 'Employee.Code'] },
    subject: 'Expiring in {{Document.DaysToExpiry}} {{Document.DaysToExpiry|plural:day/days}}: {{Document.TypeName}} — {{Employee.FullName|default:—}}',
    body:
      'Dear {{Recipient.FirstName|default:Colleague}},\n\nThe {{Document.TypeName}} of {{Employee.FullName|default:—}} ({{Employee.Code|default:—}}) expires on {{Document.ExpiryDate|date:dd-MMM-yyyy}}, in {{Document.DaysToExpiry}} {{Document.DaysToExpiry|plural:day/days}}.\n\n' +
      'Please arrange a renewed copy before that date: {{Link.RequestDetail}}' + SIGN,
  },
];

function toHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        pushEnabled: !!e.pushEnabled,
        quietHoursExempt: !!e.quietHoursExempt,
        digestEligible: !!e.digestEligible,
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
    console.log(`${company.code}: ${EVENTS.length} events, ${EVENTS.length * 2} templates`);
  }
  console.log(`Done: ${events} event upserts, ${templates} template upserts across ${companies.length} companies.`);
} finally {
  await prisma.$disconnect();
}
