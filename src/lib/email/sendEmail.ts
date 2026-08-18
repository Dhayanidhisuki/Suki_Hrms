import nodemailer, { type SendMailOptions } from "nodemailer";
import { prisma } from "@/lib/prisma";

export type EmailAttachment = NonNullable<SendMailOptions["attachments"]>[number];

export type SendEmailInput = {
  notificationId: number;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function addressList(value?: string | string[]) {
  if (!value) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

export async function sendEmail(input: SendEmailInput) {
  try {
    const port = Number(requiredEnv("SMTP_PORT"));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("SMTP_PORT must be an integer between 1 and 65535");
    }
    const transporter = nodemailer.createTransport({
      host: requiredEnv("SMTP_HOST"),
      port,
      secure: requiredEnv("SMTP_SECURE").toLowerCase() === "true",
      auth: { user: requiredEnv("SMTP_USER"), pass: requiredEnv("SMTP_PASS") },
    });
    const info = await transporter.sendMail({
      from: requiredEnv("MAIL_FROM_ADDRESS"),
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    await prisma.calibrationNotification.update({
      where: { id: input.notificationId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
        ccAddress: addressList(input.cc),
        bccAddress: addressList(input.bcc),
      },
    });
    return {
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.calibrationNotification.update({
      where: { id: input.notificationId },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 500),
        ccAddress: addressList(input.cc),
        bccAddress: addressList(input.bcc),
      },
    });
    throw error;
  }
}
