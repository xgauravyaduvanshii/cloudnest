import ContactRequestModel, {
  ContactStatus,
} from '../models/contact-request.model';
import AdminAuditModel from '../models/admin-audit.model';
import { NotFoundException } from '../utils/app-error';
import { queueTemplate } from './mail.service';
import { SubmitContactSchemaType, UpdateContactStatusSchemaType } from '../validators/contact.validator';

export const createContactService = async (
  input: SubmitContactSchemaType,
  actor?: { userId?: string | null },
) => {
  const request = await ContactRequestModel.create({
    name: input.name,
    email: input.email,
    subject: input.subject || null,
    message: input.message,
    userId: actor?.userId ?? null,
  });
  return {
    message: 'Thanks for reaching out — our team will respond by email.',
    request: toPublicRequest(request),
  };
};

export const listContactRequestsService = async (options: {
  status?: ContactStatus;
  keyword?: string;
  pageSize: number;
  pageNumber: number;
}) => {
  const { pageSize, pageNumber } = options;
  const skip = (pageNumber - 1) * pageSize;
  const { requests, totalCount } = await ContactRequestModel.listAll({
    status: options.status,
    keyword: options.keyword,
    limit: pageSize,
    offset: skip,
  });
  return {
    requests: requests.map(toPublicRequest),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
    },
  };
};

export const getMyContactRequestsService = async (
  userId: string | undefined,
  email: string | undefined,
) => {
  if (!userId || !email) return { requests: [] };
  const requests = await ContactRequestModel.listForUser(userId, email);
  return { requests: requests.map(toPublicRequest) };
};

export const updateContactStatusService = async (
  adminId: string | undefined,
  id: string,
  data: UpdateContactStatusSchemaType,
) => {
  const updated = await ContactRequestModel.setStatus(
    id,
    data.status,
    data.adminNote ?? null,
  );
  if (!updated) throw new NotFoundException('Contact request not found');

  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.contact.status_update',
    entityType: 'contact_request',
    entityId: id,
    metadata: { status: data.status },
  }).catch(() => null);

  // Notify the requester of the new status (fire-and-forget).
  queueTemplate('contact_status_update', updated.email, {
    userName: updated.name,
    subject: updated.subject || 'your request',
    status: updated.status,
    message: updated.adminNote || 'Our team has updated your request.',
  });

  return { message: 'Status updated', request: toPublicRequest(updated) };
};

export const deleteContactRequestService = async (
  adminId: string | undefined,
  id: string,
) => {
  const deleted = await ContactRequestModel.delete(id);
  if (!deleted) throw new NotFoundException('Contact request not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.contact.delete',
    entityType: 'contact_request',
    entityId: id,
  }).catch(() => null);
  return { message: 'Request deleted' };
};

/** Never leak the internal user linkage to the public payload beyond what's needed. */
const toPublicRequest = (
  request: Awaited<ReturnType<typeof ContactRequestModel.create>>,
) => ({
  id: request.id,
  name: request.name,
  email: request.email,
  subject: request.subject,
  message: request.message,
  status: request.status,
  adminNote: request.adminNote,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});
