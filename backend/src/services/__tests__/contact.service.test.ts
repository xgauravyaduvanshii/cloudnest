/**
 * Unit tests for the contact submissions service (no live DB).
 * Covers:
 *   - createContactService links the request to the acting user when a bearer is
 *     present, and stores it anonymously (userId null) otherwise
 *   - getMyContactRequestsService returns [] without identity, else delegates by
 *     (userId OR email) and strips the internal user linkage from the payload
 *   - updateContactStatusService persists the status, audits the admin action,
 *     and throws NotFound when the row is missing
 */

jest.mock('../../models/contact-request.model', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    listAll: jest.fn(),
    listForUser: jest.fn(),
    findById: jest.fn(),
    setStatus: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../models/admin-audit.model', () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue(null) },
}));

import ContactRequestModel from '../../models/contact-request.model';
import AdminAuditModel from '../../models/admin-audit.model';
import {
  createContactService,
  getMyContactRequestsService,
  updateContactStatusService,
} from '../contact.service';

const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  _id: 'c1',
  name: 'Ada',
  email: 'ada@example.com',
  userId: null,
  subject: 'Hi',
  message: 'Need help please',
  status: 'NEW',
  adminNote: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...over,
});

describe('createContactService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('links the request to the acting user when a userId is provided', async () => {
    (ContactRequestModel.create as jest.Mock).mockResolvedValue(makeRow({ userId: 'u9' }));

    const result = await createContactService(
      { name: 'Ada', email: 'ada@example.com', subject: 'Hi', message: 'Need help please' },
      { userId: 'u9' },
    );

    expect(ContactRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u9', email: 'ada@example.com' }),
    );
    // Public payload must never leak the internal user linkage.
    expect((result.request as any).userId).toBeUndefined();
    expect(result.request.status).toBe('NEW');
  });

  it('stores an anonymous submission when no actor is present', async () => {
    (ContactRequestModel.create as jest.Mock).mockResolvedValue(makeRow());

    await createContactService({
      name: 'Ada',
      email: 'ada@example.com',
      subject: '',
      message: 'Need help please',
    });

    expect(ContactRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, subject: null }),
    );
  });
});

describe('getMyContactRequestsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty list when identity is incomplete', async () => {
    const result = await getMyContactRequestsService(undefined, 'a@b.com');
    expect(result).toEqual({ requests: [] });
    expect(ContactRequestModel.listForUser).not.toHaveBeenCalled();
  });

  it('matches by user id or email and strips the userId field', async () => {
    (ContactRequestModel.listForUser as jest.Mock).mockResolvedValue([
      makeRow({ userId: 'u9' }),
    ]);

    const result = await getMyContactRequestsService('u9', 'ada@example.com');

    expect(ContactRequestModel.listForUser).toHaveBeenCalledWith('u9', 'ada@example.com');
    expect(result.requests).toHaveLength(1);
    expect((result.requests[0] as any).userId).toBeUndefined();
  });
});

describe('updateContactStatusService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the status and records an admin audit entry', async () => {
    (ContactRequestModel.setStatus as jest.Mock).mockResolvedValue(
      makeRow({ status: 'SOLVED', adminNote: 'Fixed' }),
    );

    const result = await updateContactStatusService('admin1', 'c1', {
      status: 'SOLVED',
      adminNote: 'Fixed',
    });

    expect(ContactRequestModel.setStatus).toHaveBeenCalledWith('c1', 'SOLVED', 'Fixed');
    expect(AdminAuditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.contact.status_update', entityId: 'c1' }),
    );
    expect(result.request.status).toBe('SOLVED');
  });

  it('throws NotFound when the row does not exist', async () => {
    (ContactRequestModel.setStatus as jest.Mock).mockResolvedValue(null);
    await expect(
      updateContactStatusService('admin1', 'missing', { status: 'APPROVED' }),
    ).rejects.toThrow();
  });
});
