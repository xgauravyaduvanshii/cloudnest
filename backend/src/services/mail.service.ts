import nodemailer, { Transporter } from 'nodemailer';
import { Env } from '../config/env.config';
import SmtpConfigModel, { SmtpConfigRaw } from '../models/smtp-config.model';
import EmailTemplateModel, { EmailTemplate } from '../models/email-template.model';
import { renderTemplate, withSystemVars, TemplateVars } from '../utils/render-template';
import { ErrorCodeEnum } from '../enums/error-code.enum';
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
} from '../utils/app-error';
import { logger } from '../utils/logger';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

const isEnvTruthy = (value: string) =>
  ['1', 'true', 'yes', 'on'].includes((value || '').toLowerCase());

/** Build the "Display Name <addr@host>" from header. */
const fromHeader = (config: SmtpConfigRaw): string =>
  config.fromName
    ? `${config.fromName} <${config.fromAddress}>`
    : config.fromAddress;

/** Turn a resolved config into a nodemailer transport. */
export const buildTransport = (config: SmtpConfigRaw): Transporter =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username
      ? { user: config.username, pass: config.password ?? '' }
      : undefined,
  });

/** Env-based fallback config, used only when no active DB config exists. */
const envConfig = (): SmtpConfigRaw | null => {
  if (!Env.SMTP_HOST || !Env.SMTP_FROM_ADDRESS) return null;
  return {
    id: 'env',
    name: 'Environment',
    host: Env.SMTP_HOST,
    port: parseInt(Env.SMTP_PORT, 10) || 587,
    secure: isEnvTruthy(Env.SMTP_SECURE),
    username: Env.SMTP_USERNAME || null,
    password: Env.SMTP_PASSWORD || null,
    fromName: Env.SMTP_FROM_NAME || null,
    fromAddress: Env.SMTP_FROM_ADDRESS,
    replyTo: Env.SMTP_REPLY_TO || null,
  };
};

/** Active DB config, else env fallback, else null. */
export const resolveActiveConfig = async (): Promise<SmtpConfigRaw | null> => {
  const db = await SmtpConfigModel.getActiveRaw();
  if (db) return db;
  return envConfig();
};

/** Verify SMTP credentials by opening and closing a connection. */
export const verifySmtpConnection = async (config: SmtpConfigRaw): Promise<void> => {
  const transport = buildTransport(config);
  await transport.verify();
};

/** Send a fully-rendered message using the active configuration. */
export const sendMail = async (input: SendMailInput): Promise<void> => {
  const config = await resolveActiveConfig();
  if (!config) {
    throw new InternalServerException(
      'Outbound email is not configured. Add an active SMTP configuration.',
      ErrorCodeEnum.MAIL_NOT_CONFIGURED,
    );
  }
  const transport = buildTransport(config);
  await transport.sendMail({
    from: fromHeader(config),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo ?? config.replyTo ?? undefined,
  });
};

/** Send using an explicitly supplied config (e.g. admin testing a non-active one). */
export const sendMailWithConfig = async (
  config: SmtpConfigRaw,
  input: SendMailInput,
): Promise<void> => {
  const transport = buildTransport(config);
  await transport.sendMail({
    from: fromHeader(config),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo ?? config.replyTo ?? undefined,
  });
};

/**
 * Render a template and send it. Throws if the template is missing/disabled or
 * mail is not configured. `subjectVars` defaults to the same vars as the body.
 * System vars (e.g. `currentYear` for the footer copyright) are merged in so no
 * caller has to remember to pass them.
 */
export const sendTemplate = async (
  key: string,
  to: string,
  vars: TemplateVars,
  opts?: { replyTo?: string | null },
): Promise<void> => {
  const template: EmailTemplate | null = await EmailTemplateModel.getByKey(key);
  if (!template) throw new NotFoundException(`Email template "${key}" not found`);
  if (!template.isEnabled) {
    throw new BadRequestException(`Email template "${key}" is disabled`);
  }
  const merged = withSystemVars(vars);
  await sendMail({
    to,
    subject: renderTemplate(template.subject, merged),
    html: renderTemplate(template.htmlBody, merged),
    text: renderTemplate(template.textBody, merged),
    replyTo: opts?.replyTo,
  });
};

/**
 * Fire-and-forget a templated email. Never throws: delivery problems are logged
 * so a non-critical notification can't break the primary request flow.
 */
export const queueTemplate = (
  key: string,
  to: string | null | undefined,
  vars: TemplateVars,
): void => {
  if (!to) return;
  sendTemplate(key, to, vars).catch((error) => {
    logger.error(`Failed to send "${key}" email to ${to}`, error);
  });
};
