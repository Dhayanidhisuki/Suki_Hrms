/**
 * Seeds NotificationEvent + NotificationTemplate rows for the ESS request
 * journeys — the gap behind MoM 17/July/2025 ("notifications via the employee
 * self-service portal must be configured and maintained") and ESS gap G3.
 *
 * Before this, an employee who applied for leave was told nothing when it was
 * approved or rejected; they had to reopen the page to find out.
 *
 *   node scripts/seed-ess-notification-events.mjs
 *
 * Idempotent: events upsert on (companyId, code), templates on
 * (companyId, code, versionNo=1).
 *
 * Recipients follow the shape of the request, not one blanket rule:
 *  - SUBMITTED goes to the approver (the manager), because it is an ask
 *  - APPROVED / REJECTED / CANCELLED go to the employee, because it is an answer
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

/** The ESS request types that share a submit → decide lifecycle. */
const REQUESTS = [
  { key: 'LEAVE',        module: 'LEAV', noun: 'Leave application',  link: '/ess/leave' },
  { key: 'PERMISSION',   module: 'ATTN', noun: 'Permission request', link: '/ess/permission' },
  { key: 'MISPUNCH',     module: 'ATTN', noun: 'Mis-punch request',  link: '/ess/mis-punch' },
  { key: 'OT',           module: 'ATTN', noun: 'Overtime request',   link: '/ess/ot-slip' },
  { key: 'COMP_OFF',     module: 'LEAV', noun: 'Comp-off request',   link: '/ess/comp-off' },
  { key: 'SHIFT_CHANGE', module: 'ATTN', noun: 'Shift change request', link: '/ess/shift-change' },
  { key: 'WFH',          module: 'ATTN', noun: 'Work from home request', link: '/ess/wfh' },
  { key: 'ON_DUTY',      module: 'ATTN', noun: 'On-duty request',    link: '/ess/on-duty' },
  { key: 'VISITOR_PASS', module: 'ESSV', noun: 'Visitor pass request', link: '/ess/visitor-request' },
];

const ctx = { Request: {}, optional: ['Request.Id', 'Request.Period', 'Request.Reason', 'Request.Status', 'Employee.FullName', 'Employee.Code'] };

const EVENTS = [];

for (const r of REQUESTS) {
  EVENTS.push({
    code: `${r.key}_SUBMITTED`,
    name: `${r.noun} submitted`,
    moduleCode: r.module,
    category: 'TRANSACTIONAL',
    defaultPriority: 'NORMAL',
    // The manager decides it, so the manager is told. HR is deliberately not
    // copied on every submission — that is how an inbox becomes noise.
    defaultRecipients: 'REQUESTER_MANAGER_L1',
    contextSchemaJson: ctx,
    link: r.link,
    subject: `${r.noun} awaiting your approval — {{Employee.FullName|default:—}}`,
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\n{{Employee.FullName|default:An employee}} ({{Employee.Code|default:—}}) has submitted a ${r.noun.toLowerCase()} and it is awaiting your approval.\n\nPeriod : {{Request.Period|default:—}}\nReason : {{Request.Reason|default:—}}\n\nReview: {{Link.RequestDetail}}` + SIGN,
  });

  EVENTS.push({
    code: `${r.key}_APPROVED`,
    name: `${r.noun} approved`,
    moduleCode: r.module,
    category: 'TRANSACTIONAL',
    defaultPriority: 'NORMAL',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: ctx,
    link: r.link,
    subject: `Your ${r.noun.toLowerCase()} has been approved`,
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nYour ${r.noun.toLowerCase()} has been approved.\n\nPeriod : {{Request.Period|default:—}}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
  });

  EVENTS.push({
    code: `${r.key}_REJECTED`,
    name: `${r.noun} rejected`,
    moduleCode: r.module,
    category: 'TRANSACTIONAL',
    // Being turned down is what the employee most needs to act on, so it is
    // not batched into a digest.
    defaultPriority: 'URGENT',
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    contextSchemaJson: ctx,
    link: r.link,
    subject: `Your ${r.noun.toLowerCase()} was not approved`,
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nYour ${r.noun.toLowerCase()} has not been approved.\n\nPeriod : {{Request.Period|default:—}}\nReason : {{Request.Reason|default:—}}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
  });

  EVENTS.push({
    code: `${r.key}_CANCELLED`,
    name: `${r.noun} cancelled`,
    moduleCode: r.module,
    category: 'INFORMATIONAL',
    defaultPriority: 'LOW',
    defaultRecipients: 'SUBJECT_EMPLOYEE,REQUESTER_MANAGER_L1',
    contextSchemaJson: ctx,
    link: r.link,
    subject: `${r.noun} cancelled — {{Employee.FullName|default:—}}`,
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nA ${r.noun.toLowerCase()} for {{Employee.FullName|default:the employee}} has been cancelled.\n\nPeriod : {{Request.Period|default:—}}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
  });
}

// Payslip release is not a request — it has no approver and no outcome, so it
// stands on its own rather than being forced into the lifecycle above.
EVENTS.push({
  code: 'PAYSLIP_PUBLISHED',
  name: 'Payslip published',
  moduleCode: 'PAYR',
  category: 'INFORMATIONAL',
  defaultPriority: 'NORMAL',
  defaultRecipients: 'SUBJECT_EMPLOYEE',
  contextSchemaJson: { Request: {}, optional: ['Request.Period', 'Employee.FullName', 'Employee.Code'] },
  link: '/ess/payslip',
  subject: 'Your payslip for {{Request.Period|default:this month}} is available',
  body: 'Dear {{Recipient.FirstName|default:Colleague}},\n\nYour payslip for {{Request.Period|default:this month}} is now available on the employee portal.\n\nView: {{Link.RequestDetail}}' + SIGN,
});

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
        // Email on by default; §12 of REQUIREMENTS_DECISIONS is still pending,
        // and per-event channel toggles already exist for the client to turn
        // email off without a code change.
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        quietHoursExempt: false,
        digestEligible: e.category === 'INFORMATIONAL',
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
    console.log(`${company.code}: ${EVENTS.length} ESS events, ${EVENTS.length * 2} templates`);
  }
  console.log(`Done: ${events} event upserts, ${templates} template upserts across ${companies.length} companies.`);
} finally {
  await prisma.$disconnect();
}
