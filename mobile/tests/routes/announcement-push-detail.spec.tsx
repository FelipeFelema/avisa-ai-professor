import { act, waitFor } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import AnnouncementDetails from '../../app/(app)/announcements/[id]';
import { renderWithProviders } from '../helpers/render';
import { announcementKeys, queryClient } from '@/config';
import * as announcements from '@/services/announcements/announcement.service';
import {
  bindAnnouncementPushSession,
  cancelAnnouncementPush,
  consumeAnnouncementPush,
} from '@/services/push/announcement-push-navigation';
import { resetAnnouncementPushDedupe } from '@/services/push/announcement-push-presentation';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import type { Announcement } from '@/types/announcement';
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockId = '00000000-0000-4000-8000-000000000111';
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('@/services/announcements/announcement.service', () => ({ findOne: jest.fn() }));
jest.mock('@/hooks/useDeleteAnnouncement', () => ({
  useDeleteAnnouncement: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
const payload = {
  version: 1,
  type: 'announcement-created',
  announcementId: mockId,
  dispatchId: '00000000-0000-4000-8000-000000000112',
};
const detail: Announcement = {
  id: mockId,
  classroomId: 'classroom',
  title: 'Fresh authorized title',
  content: 'Fresh authorized body',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  author: { id: 'teacher', name: 'Teacher' },
};
const findOne = jest.mocked(announcements.findOne);
queryClient.setQueryDefaults(announcementKeys.all, { gcTime: Infinity });
describe('mounted detail cannot expose stale notification content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cancelAnnouncementPush();
    resetAnnouncementPushDedupe();
    queryClient.clear();
    bindAnnouncementPushSession('member', getSessionGeneration(), mockRouter.push);
    queryClient.setQueryData(announcementKeys.detail(mockId), {
      ...detail,
      title: 'Old protected title',
    });
    findOne.mockResolvedValue(detail);
  });
  afterEach(() => {
    cancelAnnouncementPush();
    queryClient.clear();
  });
  it.each(['lost-membership', 'expired', 'deleted'])(
    'old cached detail plus %s 404 stays unavailable',
    async () => {
      const view = await renderWithProviders(<AnnouncementDetails />, {
        queryClient,
        auth: {
          user: { id: 'member', name: 'Member', email: 'member@example.test', role: 'PARENT' },
        },
      });
      await waitFor(() => expect(view.getByText('Old protected title')).toBeTruthy());
      findOne.mockRejectedValueOnce(
        new AxiosError('Unavailable', undefined, undefined, undefined, { status: 404 } as never),
      );
      await act(async () => {
        consumeAnnouncementPush(payload);
      });
      await waitFor(() => expect(view.getByText('Comunicado não encontrado')).toBeTruthy());
      expect(view.queryByText('Old protected title')).toBeNull();
      expect(queryClient.getQueryData(announcementKeys.detail(mockId))).toBeUndefined();
      expect(mockRouter.push).not.toHaveBeenCalled();
      await view.unmount();
    },
  );
  it('blocks an already mounted route while slow authorization runs and renders only fresh current 200', async () => {
    const view = await renderWithProviders(<AnnouncementDetails />, { queryClient });
    await waitFor(() => expect(view.getByText('Old protected title')).toBeTruthy());
    let resolve!: (value: Announcement) => void;
    findOne.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => {
      consumeAnnouncementPush(payload);
    });
    expect(view.queryByText('Old protected title')).toBeNull();
    expect(view.getByText('Carregando comunicado')).toBeTruthy();
    await act(async () => {
      resolve(detail);
    });
    await waitFor(() => expect(view.getByText('Fresh authorized title')).toBeTruthy());
    expect(view.queryByText('Old protected title')).toBeNull();
    await view.unmount();
  });
  it('a late prior-session 200 cannot repopulate cache or navigate after account change', async () => {
    let resolve!: (value: Announcement) => void;
    findOne.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => {
      consumeAnnouncementPush(payload);
    });
    invalidateSessionGeneration();
    cancelAnnouncementPush();
    queryClient.clear();
    bindAnnouncementPushSession('other', getSessionGeneration(), mockRouter.push);
    await act(async () => {
      resolve(detail);
    });
    expect(queryClient.getQueryData(announcementKeys.detail(mockId))).toBeUndefined();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
