import { queryClient, announcementKeys } from '@/config';
import * as announcements from '@/services/announcements/announcement.service';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import {
  bindAnnouncementPushSession,
  consumeAnnouncementPush,
  cancelAnnouncementPush,
  getAnnouncementPushState,
  retryAnnouncementPush,
} from '@/services/push/announcement-push-navigation';
import { resetAnnouncementPushDedupe } from '@/services/push/announcement-push-presentation';
import type { Announcement } from '@/types/announcement';
jest.mock('@/services/announcements/announcement.service', () => ({ findOne: jest.fn() }));
const baseData = {
  version: 1,
  type: 'announcement-created',
  announcementId: '00000000-0000-4000-8000-000000000111',
  dispatchId: '00000000-0000-4000-8000-000000000112',
};
const detail = {
  id: baseData.announcementId,
  title: 'Fresh authorized content',
  content: 'Authorized',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
} as Announcement;
const push = jest.fn();
const findOne = jest.mocked(announcements.findOne);
queryClient.setQueryDefaults(announcementKeys.all, { gcTime: Infinity });
async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}
describe.each(['announcement-created', 'announcement-expiring'])(
  'authorized %s tap intent',
  (type) => {
    const data = { ...baseData, type };
    beforeEach(() => {
      jest.clearAllMocks();
      queryClient.clear();
      cancelAnnouncementPush();
      resetAnnouncementPushDedupe();
      bindAnnouncementPushSession(null, getSessionGeneration(), push);
      findOne.mockResolvedValue(detail);
    });
    afterEach(() => {
      cancelAnnouncementPush();
      queryClient.clear();
      jest.useRealTimers();
    });
    it('erases old cache, waits for a fresh authorization and deduplicates duplicate callbacks', async () => {
      bindAnnouncementPushSession('member', getSessionGeneration(), push);
      queryClient.setQueryData(announcementKeys.detail(data.announcementId), {
        ...detail,
        title: 'Stale private content',
      });
      let resolve!: (a: Announcement) => void;
      findOne.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      consumeAnnouncementPush(data);
      consumeAnnouncementPush(data);
      await settle();
      expect(
        queryClient.getQueryData(announcementKeys.detail(data.announcementId)),
      ).toBeUndefined();
      expect(push).not.toHaveBeenCalled();
      expect(getAnnouncementPushState().status).toBe('loading');
      resolve(detail);
      await settle();
      expect(findOne).toHaveBeenCalledTimes(1);
      expect(findOne).toHaveBeenCalledWith(
        data.announcementId,
        expect.objectContaining({
          sessionGeneration: getSessionGeneration(),
          signal: expect.any(AbortSignal),
        }),
      );
      expect(push).toHaveBeenCalledWith(`/announcements/${data.announcementId}`);
      expect(queryClient.getQueryData(announcementKeys.detail(data.announcementId))).toEqual(
        detail,
      );
    });
    it('keeps initial anonymous intent only until the first authenticated session', async () => {
      consumeAnnouncementPush(data);
      await settle();
      expect(findOne).not.toHaveBeenCalled();
      bindAnnouncementPushSession('first-member', getSessionGeneration(), push);
      await settle();
      expect(findOne).toHaveBeenCalledTimes(1);
    });
    it('cancels late completion on logout/account change', async () => {
      bindAnnouncementPushSession('member', getSessionGeneration(), push);
      let resolve!: (a: Announcement) => void;
      findOne.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      consumeAnnouncementPush(data);
      await settle();
      invalidateSessionGeneration();
      cancelAnnouncementPush();
      bindAnnouncementPushSession('other', getSessionGeneration(), push);
      resolve(detail);
      await settle();
      expect(push).not.toHaveBeenCalled();
      expect(
        queryClient.getQueryData(announcementKeys.detail(data.announcementId)),
      ).toBeUndefined();
    });
    it('expires an anonymous pending intent after five minutes', async () => {
      jest.useFakeTimers();
      consumeAnnouncementPush(data);
      jest.advanceTimersByTime(5 * 60000 + 1);
      bindAnnouncementPushSession('member', getSessionGeneration(), push);
      await settle();
      expect(findOne).not.toHaveBeenCalled();
      expect(getAnnouncementPushState().status).toBe('idle');
    });
    it('404 clears stale content; transient error requires explicit retry or cancellation', async () => {
      bindAnnouncementPushSession('member', getSessionGeneration(), push);
      findOne.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
      consumeAnnouncementPush(data);
      await settle();
      expect(getAnnouncementPushState().status).toBe('unavailable');
      expect(push).not.toHaveBeenCalled();
      cancelAnnouncementPush();
      resetAnnouncementPushDedupe();
      findOne.mockRejectedValueOnce(new Error('synthetic network failure'));
      consumeAnnouncementPush(data);
      await settle();
      expect(getAnnouncementPushState().status).toBe('error');
      expect(findOne).toHaveBeenCalledTimes(2);
      await retryAnnouncementPush();
      expect(findOne).toHaveBeenCalledTimes(3);
      expect(push).toHaveBeenCalledTimes(1);
    });
  },
);
