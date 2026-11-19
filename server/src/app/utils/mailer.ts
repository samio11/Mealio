import nodemailer, { type SendMailOptions } from "nodemailer";

import { env, features } from "../config/env.ts";
import { logger } from "./logger.ts";

const smtpPort = env.EMAIL_SENDER_SMTP_PORT ?? 465;

// Gmail app passwords are often displayed with spaces; SMTP expects them removed.
const smtpPass = env.EMAIL_SENDER_SMTP_PASS?.replace(/\s+/g, "");

const transporter = features.email
  ? nodemailer.createTransport({
      host: env.EMAIL_SENDER_SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: env.EMAIL_SENDER_SMTP_USER, pass: smtpPass },
    })
  : null;

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: SendMailOptions["attachments"];
}

/**
 * Sends an email. Never throws: a mail outage must not break registration or
 * OTP flows. Failures are logged and surfaced to the caller as `false`.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  if (!transporter) {
    logger.warn({ to: input.to, subject: input.subject }, "email not configured; message skipped");
    return false;
  }
  try {
    await transporter.sendMail({
      from: env.EMAIL_SENDER_SMTP_FROM ?? env.EMAIL_SENDER_SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
    return true;
  } catch (error) {
    logger.error({ err: error, to: input.to }, "failed to send email");
    return false;
  }
}

export const mailerConfigured = features.email;
