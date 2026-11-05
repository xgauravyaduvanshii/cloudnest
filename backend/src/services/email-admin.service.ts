import AdminAuditModel from '../models/admin-audit.model';
import SmtpConfigModel, { SmtpInput } from '../models/smtp-config.model';
import EmailTemplateModel, {
  TemplateInput,
} from '../models/email-template.model';
import UserModel from '../models/user.model';
import {
  resolveActiveConfig,
  sendMailWithConfig,
  verifySmtpConnection,
} from './mail.service';
import { renderTemplate, withSystemVars, TemplateVars } from '../utils/render-template';
import { ErrorCodeEnum } from '../enums/error-code.enum';
import {
  BadRequestException,
  ConflictException,
  InternalServerException,
  NotFoundException,
} from '../utils/app-error';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------- SMTP config

export const listSmtpConfigsService = async () => {
  const configs = await SmtpConfigModel.listPublic();
  return { configs };
};

export const createSmtpConfigService = async (
  adminId: string | undefined,
  data: SmtpInput,
) => {
  const config = await SmtpConfigModel.create(data, adminId ?? null);
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.smtp.create',
    entityType: 'smtp_configurations',
    entityId: config.id,
    metadata: { name: data.name, host: data.host, port: data.port },
  }).catch(() => null);
  return { config };
};

export const updateSmtpConfigService = async (
  adminId: string | undefined,
  id: string,
  data: Partial<SmtpInput>,
) => {
  const config = await SmtpConfigModel.update(id, data);
  if (!config) throw new NotFoundException('SMTP configuration not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.smtp.update',
    entityType: 'smtp_configurations',
    entityId: id,
    metadata: {
      name: data.name,
      host: data.host,
      port: data.port,
      passwordUpdated:
        data.password !== undefined && data.password !== null && data.password !== '',
    },
  }).catch(() => null);
  return { config };
};

export const activateSmtpConfigService = async (
  adminId: string | undefined,
  id: string,
) => {
  const config = await SmtpConfigModel.setActive(id);
  if (!config) throw new NotFoundException('SMTP configuration not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.smtp.activate',
    entityType: 'smtp_configurations',
    entityId: id,
    metadata: { name: config.name },
  }).catch(() => null);
  return { config };
};

export const deleteSmtpConfigService = async (
  adminId: string | undefined,
  id: string,
) => {
  const removed = await SmtpConfigModel.remove(id);
  if (!removed) throw new NotFoundException('SMTP configuration not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.smtp.delete',
    entityType: 'smtp_configurations',
    entityId: id,
  }).catch(() => null);
  return { deleted: true };
};

export const testSmtpConnectionService = async (
  adminId: string | undefined,
  id: string,
) => {
  const config = await SmtpConfigModel.getRawById(id);
  if (!config) throw new NotFoundException('SMTP configuration not found');
  try {
    await verifySmtpConnection(config);
  } catch (error) {
    throw new BadRequestException(
      `Connection failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.smtp.test',
    entityType: 'smtp_configurations',
    entityId: id,
    metadata: { ok: true },
  }).catch(() => null);
  return { ok: true };
};

// -------------------------------------------------------------- email templates

export const listEmailTemplatesService = async () => {
  const templates = await EmailTemplateModel.listAll();
  return { templates };
};

export const createEmailTemplateService = async (
  adminId: string | undefined,
  data: TemplateInput,
) => {
  const existing = await EmailTemplateModel.getByKey(data.key);
  if (existing) throw new ConflictException('A template with that key already exists');
  const template = await EmailTemplateModel.create(data);
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.email_template.create',
    entityType: 'email_templates',
    entityId: template.id,
    metadata: { key: template.key },
  }).catch(() => null);
  return { template };
};

export const updateEmailTemplateService = async (
  adminId: string | undefined,
  id: string,
  data: Partial<TemplateInput>,
) => {
  // Guard against colliding with another template's key.
  if (data.key) {
    const byKey = await EmailTemplateModel.getByKey(data.key);
    if (byKey && byKey.id !== id) {
      throw new ConflictException('Another template already uses that key');
    }
  }
  const template = await EmailTemplateModel.update(id, data);
  if (!template) throw new NotFoundException('Email template not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.email_template.update',
    entityType: 'email_templates',
    entityId: id,
    metadata: { key: template.key },
  }).catch(() => null);
  return { template };
};

export const setEmailTemplateEnabledService = async (
  adminId: string | undefined,
  id: string,
  isEnabled: boolean,
) => {
  const template = await EmailTemplateModel.setEnabled(id, isEnabled);
  if (!template) throw new NotFoundException('Email template not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: isEnabled ? 'admin.email_template.enable' : 'admin.email_template.disable',
    entityType: 'email_templates',
    entityId: id,
    metadata: { key: template.key },
  }).catch(() => null);
  return { template };
};

export const deleteEmailTemplateService = async (
  adminId: string | undefined,
  id: string,
) => {
  const removed = await EmailTemplateModel.remove(id);
  if (!removed) throw new NotFoundException('Email template not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.email_template.delete',
    entityType: 'email_templates',
    entityId: id,
  }).catch(() => null);
  return { deleted: true };
};

// ----------------------------------------------------------------- test / send

/** Render a template (by id or key) and send it to a single test address. */
export const sendTemplateTestService = async (
  params: { templateId?: string; templateKey?: string; to: string; vars?: TemplateVars; configId?: string },
) => {
  const template = params.templateId
    ? await EmailTemplateModel.getById(params.templateId)
    : params.templateKey
      ? await EmailTemplateModel.getByKey(params.templateKey)
      : null;
  if (!template) throw new NotFoundException('Email template not found');

  const config = params.configId
    ? await SmtpConfigModel.getRawById(params.configId)
    : await resolveActiveConfig();
  if (!config) {
    throw new InternalServerException(
      'No active SMTP configuration. Add and activate one, or pick a configuration to test.',
      ErrorCodeEnum.MAIL_NOT_CONFIGURED,
    );
  }

  const vars = withSystemVars(params.vars);
  await sendMailWithConfig(config, {
    to: params.to,
    subject: renderTemplate(template.subject, vars),
    html: renderTemplate(template.htmlBody, vars),
    text: renderTemplate(template.textBody, vars),
  });
  return { sent: true, templateKey: template.key };
};

/** Broadcast a template to an audience of verified, active users. */
export const broadcastEmailService = async (
  adminId: string | undefined,
  params: { templateKey: string; audience: 'ALL' | 'USER' | 'ADMIN'; vars?: TemplateVars },
) => {
  const template = await EmailTemplateModel.getByKey(params.templateKey);
  if (!template) throw new NotFoundException('Email template not found');
  if (!template.isEnabled) throw new BadRequestException('Template is disabled');

  const config = await resolveActiveConfig();
  if (!config) {
    throw new InternalServerException(
      'No active SMTP configuration to broadcast from.',
      ErrorCodeEnum.MAIL_NOT_CONFIGURED,
    );
  }

  const recipients = await UserModel.findEmailRecipients(params.audience);
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      // System vars (e.g. `currentYear`) fill the shared footer on every message.
      const vars = withSystemVars({ userName: r.name, ...params.vars });
      await sendMailWithConfig(config, {
        to: r.email,
        subject: renderTemplate(template.subject, vars),
        html: renderTemplate(template.htmlBody, vars),
        text: renderTemplate(template.textBody, vars),
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error(`Broadcast "${template.key}" failed for ${r.email}`, error);
    }
  }

  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.email.broadcast',
    entityType: 'email_templates',
    entityId: template.id,
    metadata: { key: template.key, audience: params.audience, sent, failed },
  }).catch(() => null);

  return { total: recipients.length, sent, failed };
};
