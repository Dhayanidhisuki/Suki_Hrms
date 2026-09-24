/**
 * Re-seeds the four VISITOR_PASS notification events with the shape a visitor
 * pass actually has.
 *
 *   node scripts/seed-visitor-notification-events.mjs
 *
 * seed-ess-notification-events.mjs registers VISITOR_PASS alongside the eight
 * employee request types, which gives it their recipient rules — and those are
 * wrong here, in a way that matters:
 *
 *  - The generic SUBMITTED rule sends to REQUESTER_MANAGER_L1. A visitor pass
 *    is not approved by the raiser's manager; it is approved by the HOST, the
 *    employee being visited (see the approve route, which lets the host act
 *    without the HR-level grant). So SUBMITTED goes to SUBJECT_EMPLOYEE and
 *    the call site passes subjectEmpId = personToMeetId.
 *  - The generic APPROVED/REJECTED rule sends to SUBJECT_EMPLOYEE. With the
 *    subject now being the host, the person who raised the request would never
 *    be told the outcome, so those go to REQUESTER instead.
 *
 * The wording differs too: the generic templates say "your request", but the
 * subject of this one is an external visitor with no employee record, so the
 * templates name the visitor and the pass number instead.
 *
 * Idempotent: upserts on (companyId, code) and (companyId, code, versionNo=1),
 * overwriting whatever the ESS seed left behind.
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

const ctx = {
  Visitor: {},
  optional: ['Visitor.Name', 'Visitor.PassNo', 'Visitor.Host', 'Visitor.Date', 'Visitor.Purpose', 'Visitor.Reason'],
};

const DETAILS = 'Visitor : {{Visitor.Name|default:—}}\nPass No : {{Visitor.PassNo|default:—}}\nTo meet : {{Visitor.Host|default:—}}\nDate    : {{Visitor.Date|default:—}}\nPurpose : {{Visitor.Purpose|default:—}}';

const EVENTS = [
  {
    code: 'VISITOR_PASS_SUBMITTED',
    name: 'Visitor pass request submitted',
    defaultPriority: 'NORMAL',
    // The host approves the visit, so the host is told.
    defaultRecipients: 'SUBJECT_EMPLOYEE',
    subject: 'Visitor request awaiting your approval — {{Visitor.Name|default:a visitor}}',
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nA visitor has requested to meet you and the request is awaiting your approval.\n\n${DETAILS}\n\nReview: {{Link.RequestDetail}}` + SIGN,
  },
  {
    code: 'VISITOR_PASS_APPROVED',
    name: 'Visitor pass request approved',
    defaultPriority: 'NORMAL',
    // The raiser needs the outcome; the host gets it as confirmation.
    defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE',
    subject: 'Visitor pass {{Visitor.PassNo|default:—}} approved',
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nThe visitor pass below has been approved.\n\n${DETAILS}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
  },
  {
    code: 'VISITOR_PASS_REJECTED',
    name: 'Visitor pass request rejected',
    // A turned-down visit needs action before the visitor turns up at the gate.
    defaultPriority: 'URGENT',
    // The host is copied, not just the raiser: gate passes are often raised by
    // a reception or admin login with no employee record of its own, and
    // REQUESTER then resolves to nobody. Without the host here, a rejection on
    // such a pass would notify no one at all — and the host is the one
    // expecting someone at the gate.
    defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE',
    subject: 'Visitor pass {{Visitor.PassNo|default:—}} rejected',
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nThe visitor pass below has been rejected.\n\n${DETAILS}\nReason  : {{Visitor.Reason|default:—}}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
  },
  {
    code: 'VISITOR_PASS_CANCELLED',
    name: 'Visitor pass request cancelled',
    defaultPriority: 'NORMAL',
    // The host is the one expecting someone at the gate.
    defaultRecipients: 'SUBJECT_EMPLOYEE,REQUESTER',
    subject: 'Visitor pass {{Visitor.PassNo|default:—}} cancelled',
    body: `Dear {{Recipient.FirstName|default:Colleague}},\n\nThe visitor pass below has been cancelled — the visit is no longer expected.\n\n${DETAILS}\n\nDetails: {{Link.RequestDetail}}` + SIGN,
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
        moduleCode: 'ESSV',
        category: 'TRANSACTIONAL',
        defaultPriority: e.defaultPriority,
        defaultRecipients: e.defaultRecipients,
        contextSchemaJson: JSON.stringify(ctx),
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
        quietHoursExempt: false,
        digestEligible: false,
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
    console.log(`${company.code}: ${EVENTS.length} visitor events, ${EVENTS.length * 2} templates`);
  }
  console.log(`Done: ${events} event upserts, ${templates} template upserts across ${companies.length} companies.`);
} finally {
  await prisma.$disconnect();
}
