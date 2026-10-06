import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthContext } from '@/contexts/AuthContext';
import { PushProvider } from '@/providers/PushProvider';
import { getPushRuntimeConfig } from '@/config/push-config';
import { addConnectivityListener } from '@/lib/api';
import { getSessionGeneration, invalidateSessionGeneration } from '@/lib/session-generation';
import * as pushLifecycle from '@/services/push/push-lifecycle';
import type { Notification, NotificationHandler, NotificationResponse } from 'expo-notifications';
import {
  rememberPushTestAttempt,
  subscribePushTestPresentation,
} from '@/services/push/push-presentation';
import { pushMocks } from '../helpers/push';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush }) }));
jest.mock('@/config/push-config', () => ({
  getPushRuntimeConfig: jest.fn(),
}));
jest.mock('@/services/push/push-lifecycle', () => ({
  reconcilePushNotifications: jest.fn(async (_generation?: number) => ({
    status: 'NOT_REQUESTED',
    message: null,
  })),
}));
jest.mock('@/lib/api', () => ({ addConnectivityListener: jest.fn() }));

const notifications = jest.mocked(Notifications);
const runtimeConfig = jest.mocked(getPushRuntimeConfig);
const reconcile = jest.mocked(pushLifecycle.reconcilePushNotifications);
const subscribeConnectivity = jest.mocked(addConnectivityListener);
const auth = {
  user: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test', role: 'PARENT' as const },
  isAuthenticated: true,
  isLoading: false,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
  applyProfileUpdate: () => undefined,
  expireSession: async () => undefined,
};

describe('PushProvider', () => {
  const previous = {
    project: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    androidId: process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID,
    iosId: process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    subscribeConnectivity.mockImplementation(() => jest.fn());
    runtimeConfig.mockReturnValue({
      available: true,
      platform: 'ANDROID',
      projectId: '00000000-0000-4000-8000-000000000010',
      reason: null,
    });
    pushMocks.device.isDevice = true;
    pushMocks.device.osName = 'Android';
    pushMocks.constants.appOwnership = null;
    pushMocks.constants.executionEnvironment = 'standalone';
    pushMocks.constants.easConfig.projectId = '00000000-0000-4000-8000-000000000010';
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID = 'com.example.avisa';
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER = 'com.example.avisa';
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  });

  afterAll(() => {
    if (previous.project === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = previous.project;
    if (previous.androidId === undefined) delete process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID;
    else process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID = previous.androidId;
    if (previous.iosId === undefined) delete process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER;
    else process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER = previous.iosId;
  });

  it('does not load push SDK handlers or listeners on web, simulator, or unconfigured builds', async () => {
    for (const reason of [
      'UNSUPPORTED_PLATFORM',
      'DEVICE_UNAVAILABLE',
      'CONFIGURATION_UNAVAILABLE',
    ] as const) {
      runtimeConfig.mockReturnValue({
        available: false,
        platform: null,
        projectId: null,
        reason,
      });
      const view = await render(
        <AuthContext.Provider value={auth}>
          <PushProvider>
            <></>
          </PushProvider>
        </AuthContext.Provider>,
      );
      await act(async () => Promise.resolve());
      await view.unmount();
    }

    expect(notifications.setNotificationHandler).not.toHaveBeenCalled();
    expect(notifications.addNotificationReceivedListener).not.toHaveBeenCalled();
    expect(notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('reconciles only an opted-in session on mount and foreground without prompting', async () => {
    const removeReceived = jest.fn();
    const removeResponse = jest.fn();
    notifications.addNotificationReceivedListener.mockReturnValue({ remove: removeReceived });
    notifications.addNotificationResponseReceivedListener.mockReturnValue({
      remove: removeResponse,
    });
    const addStateListener = jest.spyOn(AppState, 'addEventListener');
    const view = await render(
      <AuthContext.Provider value={auth}>
        <PushProvider>
          <></>
        </PushProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    expect(notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
    expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(addStateListener).toHaveBeenCalledWith('change', expect.any(Function));

    const stateListener = addStateListener.mock.calls[0]?.[1] as
      ((state: 'active' | 'background') => void) | undefined;
    await act(async () => {
      stateListener?.('background');
      stateListener?.('active');
    });
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));

    await view.unmount();
    expect(removeReceived).toHaveBeenCalledTimes(1);
    expect(removeResponse).toHaveBeenCalledTimes(1);
  });

  it('reconciles after a native token change or network response and removes every listener', async () => {
    const removeReceived = jest.fn();
    const removeResponse = jest.fn();
    const removePushToken = jest.fn();
    const removeConnectivity = jest.fn();
    let pushTokenListener: ((token: { data: string; type: string }) => void) | undefined;
    let connectivityListener: (() => void | Promise<void>) | undefined;
    notifications.addNotificationReceivedListener.mockReturnValue({ remove: removeReceived });
    notifications.addNotificationResponseReceivedListener.mockReturnValue({
      remove: removeResponse,
    });
    notifications.addPushTokenListener.mockImplementation((listener) => {
      pushTokenListener = listener;
      return { remove: removePushToken };
    });
    subscribeConnectivity.mockImplementation((listener) => {
      connectivityListener = listener;
      return removeConnectivity;
    });

    const view = await render(
      <AuthContext.Provider value={auth}>
        <PushProvider>
          <></>
        </PushProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    const generation = getSessionGeneration();

    await act(async () => {
      pushTokenListener?.({ data: 'raw-native-token-must-not-be-forwarded', type: 'android' });
      await connectivityListener?.();
    });
    expect(reconcile).toHaveBeenCalledTimes(3);
    expect(reconcile).toHaveBeenNthCalledWith(2, generation);
    expect(reconcile).toHaveBeenNthCalledWith(3, generation);
    expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();

    await view.unmount();
    expect(removeReceived).toHaveBeenCalledTimes(1);
    expect(removeResponse).toHaveBeenCalledTimes(1);
    expect(removePushToken).toHaveBeenCalledTimes(1);
    expect(removeConnectivity).toHaveBeenCalledTimes(1);
  });

  it('ignores callbacks captured by a session generation that has ended', async () => {
    let pushTokenListener: ((token: { data: string; type: string }) => void) | undefined;
    notifications.addPushTokenListener.mockImplementation((listener) => {
      pushTokenListener = listener;
      return { remove: jest.fn() };
    });
    const view = await render(
      <AuthContext.Provider value={auth}>
        <PushProvider>
          <></>
        </PushProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    invalidateSessionGeneration();

    await act(async () => {
      pushTokenListener?.({ data: 'stale-native-token', type: 'android' });
    });

    expect(reconcile).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it('presents only test notifications once and opens the notification area on tap', async () => {
    const attemptId = '00000000-0000-4000-8000-000000000812';
    const forgetAttempt = rememberPushTestAttempt(attemptId);
    const onPresentation = jest.fn();
    const stopListening = subscribePushTestPresentation(onPresentation);
    let receivedListener: ((notification: Notification) => void) | undefined;
    let responseListener: ((response: NotificationResponse) => void) | undefined;
    const captured: { handler?: NotificationHandler } = {};
    notifications.addNotificationReceivedListener.mockImplementation((listener) => {
      receivedListener = listener;
      return { remove: jest.fn() };
    });
    notifications.addNotificationResponseReceivedListener.mockImplementation((listener) => {
      responseListener = listener;
      return { remove: jest.fn() };
    });
    notifications.setNotificationHandler.mockImplementation((handler) => {
      captured.handler = handler ?? undefined;
    });

    const view = await render(
      <AuthContext.Provider value={auth}>
        <PushProvider>
          <></>
        </PushProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    const notificationHandler = captured.handler;
    if (!notificationHandler) throw new Error('Notification handler was not installed.');

    const testNotification = {
      date: Date.now(),
      request: { content: { data: { type: 'push-test', attemptId } } },
    } as unknown as Notification;
    const ordinaryNotification = {
      date: Date.now(),
      request: { content: { data: { type: 'announcement', attemptId } } },
    } as unknown as Notification;
    await expect(notificationHandler?.handleNotification(testNotification)).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
    await expect(
      notificationHandler?.handleNotification(ordinaryNotification),
    ).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false });

    receivedListener?.(testNotification);
    responseListener?.({ notification: testNotification } as NotificationResponse);
    expect(onPresentation).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/notifications');

    await view.unmount();
    stopListening();
    forgetAttempt();
  });
});
