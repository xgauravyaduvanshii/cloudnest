import NoticeModel, {
  NoticeDocument,
} from '../models/notice.model';
import AdminAuditModel from '../models/admin-audit.model';
import { NotFoundException } from '../utils/app-error';
import {
  CreateNoticeSchemaType,
  UpdateNoticeSchemaType,
} from '../validators/notices.validator';

const toPublic = (notice: NoticeDocument) => ({
  id: notice.id,
  title: notice.title,
  body: notice.body,
  level: notice.level,
  audience: notice.audience,
  isPublished: notice.isPublished,
  isDismissable: notice.isDismissable,
  priority: notice.priority,
  startsAt: notice.startsAt,
  endsAt: notice.endsAt,
  createdAt: notice.createdAt,
  updatedAt: notice.updatedAt,
});

const audienceMatches = (notice: NoticeDocument, role: string) => {
  if (notice.audience === 'ALL') return true;
  if (notice.audience === 'ADMIN') return role === 'ADMIN';
  return true; // USER audience shows to everyone signed in
};

export const listActiveNoticesService = async (
  userId: string,
  role: string,
) => {
  const [notices, dismissed] = await Promise.all([
    NoticeModel.listPublished(),
    NoticeModel.listDismissedIdsForUser(userId),
  ]);
  const dismissedSet = new Set(dismissed);
  return {
    notices: notices
      .filter((n) => audienceMatches(n, role))
      .filter((n) => !dismissedSet.has(n.id))
      .map(toPublic),
  };
};

/** Public (unauthenticated) notices: ALL-audience only, no dismissal state. */
export const listPublicNoticesService = async () => {
  const notices = await NoticeModel.listPublished();
  return {
    notices: notices
      .filter((n) => n.audience === 'ALL')
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        level: n.level,
        priority: n.priority,
      })),
  };
};

export const listAllNoticesService = async () => {
  const notices = await NoticeModel.listAll();
  return { notices: notices.map(toPublic) };
};

export const createNoticeService = async (
  adminId: string | undefined,
  data: CreateNoticeSchemaType,
) => {
  const notice = await NoticeModel.create({
    ...data,
    startsAt: data.startsAt ?? null,
    endsAt: data.endsAt ?? null,
    createdBy: adminId ?? null,
  });
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.notice.create',
    entityType: 'notice',
    entityId: notice.id,
    metadata: { level: notice.level, audience: notice.audience },
  }).catch(() => null);
  return { message: 'Notice created', notice: toPublic(notice) };
};

export const updateNoticeService = async (
  adminId: string | undefined,
  id: string,
  data: UpdateNoticeSchemaType,
) => {
  const notice = await NoticeModel.update(id, data);
  if (!notice) throw new NotFoundException('Notice not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.notice.update',
    entityType: 'notice',
    entityId: id,
  }).catch(() => null);
  return { message: 'Notice updated', notice: toPublic(notice) };
};

export const deleteNoticeService = async (
  adminId: string | undefined,
  id: string,
) => {
  const deleted = await NoticeModel.delete(id);
  if (!deleted) throw new NotFoundException('Notice not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.notice.delete',
    entityType: 'notice',
    entityId: id,
  }).catch(() => null);
  return { message: 'Notice deleted' };
};

export const dismissNoticeService = async (userId: string, noticeId: string) => {
  const notice = await NoticeModel.findById(noticeId);
  if (!notice) throw new NotFoundException('Notice not found');
  await NoticeModel.dismiss(userId, noticeId);
  return { message: 'Notice dismissed' };
};

export const undismissNoticeService = async (
  userId: string,
  noticeId: string,
) => {
  await NoticeModel.undismiss(userId, noticeId);
  return { message: 'Notice restored' };
};
