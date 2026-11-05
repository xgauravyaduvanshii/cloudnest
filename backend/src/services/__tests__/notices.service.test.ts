/**
 * Unit tests for the notices service (no live DB).
 * Covers:
 *   - listActiveNoticesService filters by audience + removes dismissed notices
 *   - ADMIN-only notices are hidden from USER-role viewers
 *   - listPublicNoticesService returns only ALL-audience notices with a minimal shape
 *   - dismiss/undismiss delegate to the model and validate existence
 */

jest.mock('../../models/notice.model', () => ({
  __esModule: true,
  default: {
    listPublished: jest.fn(),
    listAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    listDismissedIdsForUser: jest.fn(),
    dismiss: jest.fn(),
    undismiss: jest.fn(),
  },
}));

jest.mock('../../models/admin-audit.model', () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue(null) },
}));

import NoticeModel from '../../models/notice.model';
import {
  dismissNoticeService,
  listActiveNoticesService,
  listPublicNoticesService,
} from '../notices.service';

const notice = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  _id: 'n1',
  title: 'Hello',
  body: 'Body text',
  level: 'info',
  audience: 'ALL',
  isPublished: true,
  isDismissable: true,
  priority: 10,
  startsAt: null,
  endsAt: null,
  createdBy: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...over,
});

describe('listActiveNoticesService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes dismissed notices and audience-mismatched ones', async () => {
    (NoticeModel.listPublished as jest.Mock).mockResolvedValue([
      notice({ id: 'a', audience: 'ALL' }),
      notice({ id: 'b', audience: 'ALL' }),
      notice({ id: 'admin-only', audience: 'ADMIN' }),
    ]);
    (NoticeModel.listDismissedIdsForUser as jest.Mock).mockResolvedValue(['b']);

    const { notices } = await listActiveNoticesService('u1', 'USER');

    expect(notices.map((n) => n.id)).toEqual(['a']);
  });

  it('shows ADMIN notices to an admin viewer', async () => {
    (NoticeModel.listPublished as jest.Mock).mockResolvedValue([
      notice({ id: 'admin-only', audience: 'ADMIN' }),
    ]);
    (NoticeModel.listDismissedIdsForUser as jest.Mock).mockResolvedValue([]);

    const { notices } = await listActiveNoticesService('u1', 'ADMIN');
    expect(notices.map((n) => n.id)).toEqual(['admin-only']);
  });
});

describe('listPublicNoticesService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns only ALL-audience notices with a minimal shape', async () => {
    (NoticeModel.listPublished as jest.Mock).mockResolvedValue([
      notice({ id: 'a', audience: 'ALL' }),
      notice({ id: 'u', audience: 'USER' }),
    ]);

    const { notices } = await listPublicNoticesService();

    expect(notices).toHaveLength(1);
    expect(Object.keys(notices[0]).sort()).toEqual(
      ['body', 'id', 'level', 'priority', 'title'].sort(),
    );
  });
});

describe('dismissNoticeService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dismisses an existing notice', async () => {
    (NoticeModel.findById as jest.Mock).mockResolvedValue(notice());
    (NoticeModel.dismiss as jest.Mock).mockResolvedValue(undefined);

    const result = await dismissNoticeService('u1', 'n1');
    expect(NoticeModel.dismiss).toHaveBeenCalledWith('u1', 'n1');
    expect(result.message).toBe('Notice dismissed');
  });

  it('throws when the notice does not exist', async () => {
    (NoticeModel.findById as jest.Mock).mockResolvedValue(null);
    await expect(dismissNoticeService('u1', 'missing')).rejects.toThrow();
  });
});
