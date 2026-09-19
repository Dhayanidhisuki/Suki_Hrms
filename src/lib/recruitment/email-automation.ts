/**
 * Communication / Email automation helper (BRD §5.5, §5.21, §10.4, §10.6).
 *
 * Logs a CommunicationLog row for every email event. Actual SMTP dispatch is
 * a future concern (wire nodemailer/SES here); for now we persist the
 * rendered email so HR can review the communication trail and resend.
 *
 * Portal link generation (BRD §10.6): ensurePortalLink() returns an active
 * token-based portal link for a candidate, creating one if needed.
 */

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export interface SendEmailArgs {
  candidateId: number;
  eventType: string; // e.g. 'Application Received', 'Interview Invitation', 'Rejection'
  toEmail: string;
  subject: string;
  body: string;
  emailTemplateId?: number | null;
}

export async function logCommunication(args: SendEmailArgs): Promise<void> {
  await prisma.communicationLog.create({
    data: {
      candidateId: args.candidateId,
      emailTemplateId: args.emailTemplateId ?? null,
      eventType: args.eventType,
      toEmail: args.toEmail,
      subject: args.subject,
      body: args.body,
      status: 'Sent',
      sentAt: new Date(),
    },
  });
}

/**
 * Ensure a candidate has an active portal link (BRD §10.6).
 * Returns the absolute portal URL. Creates a token if none exists or if the
 * existing one has expired. Origin is required to build the absolute URL.
 */
export async function ensurePortalLink(candidateId: number, origin: string): Promise<string> {
  const existing = await prisma.candidatePortalToken.findFirst({
    where: { candidateId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return `${origin}/portal?t=${existing.token}`;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await prisma.candidatePortalToken.create({
    data: { candidateId, token, expiresAt },
  });
  return `${origin}/portal?t=${token}`;
}

/**
 * Look up an EmailTemplate by event code, render placeholders, and log.
 * Returns true if a template was found and logged.
 *
 * If the template body contains {PortalLink}, an active portal link is
 * generated and substituted (BRD §10.6).
 */
export async function sendTemplatedEmail(
  candidateId: number,
  eventCode: string,
  candidateEmail: string,
  candidateName: string,
  designationName?: string | null,
  companyName?: string | null,
  origin?: string
): Promise<boolean> {
  const template = await prisma.emailTemplate.findFirst({
    where: { event: eventCode, isActive: true },
    orderBy: { id: 'desc' },
  });
  if (!template) return false;

  // Generate portal link if the template references it
  let portalLink = '';
  if (template.body.includes('{PortalLink}') && origin) {
    portalLink = await ensurePortalLink(candidateId, origin);
  }

  const render = (text: string) =>
    text
      .replaceAll('{CandidateName}', candidateName)
      .replaceAll('{Designation}', designationName ?? '')
      .replaceAll('{CompanyName}', companyName ?? '')
      .replaceAll('{Date}', new Date().toLocaleDateString())
      .replaceAll('{PortalLink}', portalLink);

  await logCommunication({
    candidateId,
    eventType: eventCode,
    toEmail: candidateEmail,
    subject: render(template.subject),
    body: render(template.body),
    emailTemplateId: template.id,
  });
  return true;
}

/**
 * Rejection automation (BRD §10.4).
 * Auto-logs a rejection email when a candidate is moved to REJECTED status.
 */
export async function triggerRejectionEmail(
  candidateId: number,
  candidateEmail: string,
  candidateName: string,
  designationName?: string | null,
  companyName?: string | null
): Promise<void> {
  await sendTemplatedEmail(candidateId, 'Rejection', candidateEmail, candidateName, designationName, companyName);
}
