import { act, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AuthContext } from '@/contexts/AuthContext';
import { PushProvider } from '@/providers/PushProvider';
import { getPushRuntimeConfig } from '@/config/push-config';
import {
  cancelAnnouncementPush,
  getAnnouncementPushState,
} from '@/services/push/announcement-push-navigation';
import { resetAnnouncementPushDedupe } from '@/services/push/announcement-push-presentation';
import * as announcements from '@/services/announcements/announcement.service';
import type { Announcement } from '@/types/announcement';
import type { Notification, NotificationHandler, NotificationResponse } from 'expo-notifications';
import { announcementKeys, queryClient } from '@/config';
queryClient.setQueryDefaults(announcementKeys.all, { gcTime: Infinity });
const mockRouter = { push: jest.fn() };
let mockReady = true;
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useRootNavigationState: () => (mockReady ? { key: 'ready' } : undefined),
}));
jest.mock('@/config/push-config', () => ({ getPushRuntimeConfig: jest.fn() }));
jest.mock('@/services/announcements/announcement.service', () => ({ findOne: jest.fn() }));
jest.mock('@/services/push/push-lifecycle', () => ({ reconcilePushNotifications: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ palette: require('@/theme').lightTheme }),
}));
const auth = {
  user: { id: 'member', name: 'Pessoa', email: 'member@example.test', role: 'PARENT' as const },
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  applyProfileUpdate: () => {},
  expireSession: async () => {},
};
const basePayload = {
  version: 1,
  type: 'announcement-created',
  announcementId: '00000000-0000-4000-8000-000000000111',
  dispatchId: '00000000-0000-4000-8000-000000000112',
};
describe.each(['announcement-created', 'announcement-expiring'])(
  'business %s SDK callbacks',
  (type) => {
    const payload = { ...basePayload, type };
    const notification = { request: { content: { data: payload } } } as unknown as Notification;
    const response = { notification } as NotificationResponse;
    beforeEach(() => {
      jest.clearAllMocks();
      mockReady = true;
      cancelAnnouncementPush();
      resetAnnouncementPushDedupe();
      queryClient.clear();
      jest.mocked(getPushRuntimeConfig).mockReturnValue({
        available: true,
        platform: 'ANDROID',
        projectId: 'synthetic',
        reason: null,
      });
      jest.mocked(announcements.findOne).mockResolvedValue({
        id: payload.announcementId,
        title: 'Authorized',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      } as Announcement);
      jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
    });
    afterEach(() => {
      cancelAnnouncementPush();
      queryClient.clear();
    });
    function tree(value = auth) {
      return (
        <AuthContext.Provider value={value}>
          <PushProvider>
            <></>
          </PushProvider>
        </AuthContext.Provider>
      );
    }
    it('foreground presents generic known payload once without navigating or prompting', async () => {
      let handler: NotificationHandler | null = null;
      jest.mocked(Notifications.setNotificationHandler).mockImplementation((value) => {
        handler = value;
      });
      const view = await render(tree());
      await waitFor(() => expect(handler).not.toBeNull());
      const current = handler as unknown as NotificationHandler;
      await expect(current.handleNotification(notification)).resolves.toMatchObject({
        shouldShowBanner: true,
        shouldPlaySound: true,
      });
      await expect(current.handleNotification(notification)).resolves.toMatchObject({
        shouldShowBanner: false,
      });
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(announcements.findOne).not.toHaveBeenCalled();
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      await view.unmount();
    });
    it('deduplicates live and cold response; consumes and clears last native response', async () => {
      let callback: ((event: NotificationResponse) => void) | undefined;
      jest
        .mocked(Notifications.addNotificationResponseReceivedListener)
        .mockImplementation((listener) => {
          callback = listener;
          return { remove: jest.fn() };
        });
      jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(response);
      const view = await render(tree());
      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
      await act(async () => {
        callback?.(response);
      });
      expect(announcements.findOne).toHaveBeenCalledTimes(1);
      expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
      await view.unmount();
    });
    it('waits for auth/router hydration; removes callbacks and discards captured callbacks after unmount', async () => {
      mockReady = false;
      const view = await render(tree());
      expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
      mockReady = true;
      await view.rerender(tree({ ...auth, isLoading: true }));
      expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
      let callback: ((event: NotificationResponse) => void) | undefined;
      const remove = jest.fn();
      jest
        .mocked(Notifications.addNotificationResponseReceivedListener)
        .mockImplementation((listener) => {
          callback = listener;
          return { remove };
        });
      await view.rerender(tree());
      await waitFor(() => expect(callback).toBeDefined());
      await view.unmount();
      await act(async () => {
        callback?.(response);
      });
      expect(remove).toHaveBeenCalled();
      expect(getAnnouncementPushState().status).toBe('idle');
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  },
);
