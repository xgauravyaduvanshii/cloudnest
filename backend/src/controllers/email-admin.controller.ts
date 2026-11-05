import { Request, Response } from 'express';
import { HTTPSTATUS } from '../config/http.config';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import {
  createSmtpConfigSchema,
  smtpIdSchema,
  smtpTestSendSchema,
  updateSmtpConfigSchema,
} from '../validators/smtp.validator';
import {
  broadcastEmailSchema,
  createEmailTemplateSchema,
  emailTemplateEnabledSchema,
  emailTemplateIdSchema,
  sendTemplateTestSchema,
  updateEmailTemplateSchema,
} from '../validators/email-template.validator';
import {
  activateSmtpConfigService,
  broadcastEmailService,
  createEmailTemplateService,
  createSmtpConfigService,
  deleteEmailTemplateService,
  deleteSmtpConfigService,
  listEmailTemplatesService,
  listSmtpConfigsService,
  sendTemplateTestService,
  setEmailTemplateEnabledService,
  testSmtpConnectionService,
  updateEmailTemplateService,
  updateSmtpConfigService,
} from '../services/email-admin.service';

// ------------------------------------------------------------------ SMTP

export const adminListSmtpController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await listSmtpConfigsService();
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'SMTP configurations retrieved', ...result });
  },
);

export const adminCreateSmtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createSmtpConfigSchema.parse(req.body);
    const result = await createSmtpConfigService(req.user!._id, body);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: 'SMTP configuration created', ...result });
  },
);

export const adminUpdateSmtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = smtpIdSchema.parse(req.params.id);
    const body = updateSmtpConfigSchema.parse(req.body);
    const result = await updateSmtpConfigService(req.user!._id, id, body);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'SMTP configuration updated', ...result });
  },
);

export const adminActivateSmtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = smtpIdSchema.parse(req.params.id);
    const result = await activateSmtpConfigService(req.user!._id, id);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'SMTP configuration activated', ...result });
  },
);

export const adminDeleteSmtpController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = smtpIdSchema.parse(req.params.id);
    const result = await deleteSmtpConfigService(req.user!._id, id);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'SMTP configuration deleted', ...result });
  },
);

export const adminTestSmtpConnectionController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = smtpIdSchema.parse(req.params.id);
    const result = await testSmtpConnectionService(req.user!._id, id);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'SMTP connection verified', ...result });
  },
);

export const adminSmtpTestSendController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = smtpTestSendSchema.parse(req.body);
    const result = await sendTemplateTestService(body);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Test email sent', ...result });
  },
);

// -------------------------------------------------------------- templates

export const adminListEmailTemplatesController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await listEmailTemplatesService();
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Email templates retrieved', ...result });
  },
);

export const adminCreateEmailTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createEmailTemplateSchema.parse(req.body);
    const result = await createEmailTemplateService(req.user!._id, body);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: 'Email template created', ...result });
  },
);

export const adminUpdateEmailTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = emailTemplateIdSchema.parse(req.params.id);
    const body = updateEmailTemplateSchema.parse(req.body);
    const result = await updateEmailTemplateService(req.user!._id, id, body);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Email template updated', ...result });
  },
);

export const adminSetEmailTemplateEnabledController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = emailTemplateIdSchema.parse(req.params.id);
    const { isEnabled } = emailTemplateEnabledSchema.parse(req.body);
    const result = await setEmailTemplateEnabledService(
      req.user!._id,
      id,
      isEnabled,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Email template updated', ...result });
  },
);

export const adminDeleteEmailTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = emailTemplateIdSchema.parse(req.params.id);
    const result = await deleteEmailTemplateService(req.user!._id, id);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Email template deleted', ...result });
  },
);

export const adminSendTemplateTestController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = emailTemplateIdSchema.parse(req.params.id);
    const body = sendTemplateTestSchema.parse(req.body);
    const result = await sendTemplateTestService({ templateId: id, ...body });
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Test email sent', ...result });
  },
);

export const adminBroadcastEmailController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = broadcastEmailSchema.parse(req.body);
    const result = await broadcastEmailService(req.user!._id, body);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: 'Broadcast completed', ...result });
  },
);
