import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  bindAnnouncementPushSession,
  cancelAnnouncementPush,
  consumeAnnouncementPush,
  getAnnouncementPushState,
} from '@/services/push/announcement-push-navigation';
import { resetAnnouncementPushDedupe } from '@/services/push/announcement-push-presentation';
import { getSessionGeneration } from '@/lib/session-generation';

describe.each(['announcement-created', 'announcement-expiring'])('%s intent privacy', (type) => {
  afterEach(() => {
    cancelAnnouncementPush();
    resetAnnouncementPushDedupe();
    jest.restoreAllMocks();
  });
  it('rejects private/URL extensions without logging or persisting the rejected values', () => {
    const logs = [
      jest.spyOn(console, 'log'),
      jest.spyOn(console, 'warn'),
      jest.spyOn(console, 'error'),
    ];
    const push = jest.fn();
    bindAnnouncementPushSession(null, getSessionGeneration(), push);
    const payload = {
      version: 1,
      type,
      announcementId: '00000000-0000-4000-8000-000000000111',
      dispatchId: '00000000-0000-4000-8000-000000000112',
    };
    for (const extra of [
      { url: 'https://example.test/private' },
      { expoToken: 'SYNTHETIC-PRIVATE-TOKEN' },
      { capability: 'SYNTHETIC-CAPABILITY' },
      { content: 'PRIVATE-SCHOOL-BODY' },
      { userId: 'PRIVATE-ACCOUNT' },
    ])
      expect(consumeAnnouncementPush({ ...payload, ...extra })).toBe(false);
    expect(getAnnouncementPushState()).toEqual({ status: 'idle' });
    expect(push).not.toHaveBeenCalled();
    expect(logs.every((log) => log.mock.calls.length === 0)).toBe(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(consumeAnnouncementPush(payload)).toBe(true);
    expect(Object.keys(getAnnouncementPushState()).sort()).toEqual([
      'announcementId',
      'generation',
      'status',
    ]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
