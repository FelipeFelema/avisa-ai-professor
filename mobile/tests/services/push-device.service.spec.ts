import { jest } from '@jest/globals';
import { resolvePushRuntimeConfig } from '@/config/push-config';
import {
  getExpoPushToken,
  getPushDeviceAvailability,
  readPushPermission,
  requestPushPermission,
} from '@/services/push/push-device.service';

const mockNotifications = {
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  setNotificationChannelAsync: jest.fn<(id: string, channel: unknown) => Promise<null>>(),
  getPermissionsAsync: jest.fn<() => Promise<never>>(),
  requestPermissionsAsync: jest.fn<(options?: unknown) => Promise<never>>(),
  getExpoPushTokenAsync: jest.fn<(options?: unknown) => Promise<never>>(),
};
const notifications = mockNotifications as unknown as typeof import('expo-notifications');
const mockDevice = { isDevice: true, osName: 'Android' };
const mockConstants = {
  appOwnership: null as string | null,
  executionEnvironment: 'standalone',
  easConfig: { projectId: '00000000-0000-4000-8000-000000000010' as string | undefined },
  expoConfig: {
    extra: { eas: { projectId: '00000000-0000-4000-8000-000000000010' as string | undefined } },
  },
};

function runtimeConfig() {
  return resolvePushRuntimeConfig({
    platform: mockDevice.osName === 'iOS' ? 'ios' : 'android',
    device: mockDevice,
    constants: mockConstants,
    env: process.env,
  });
}

describe('push device service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice.isDevice = true;
    mockDevice.osName = 'Android';
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID = 'com.example.avisa';
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER = 'com.example.avisa';
    mockConstants.appOwnership = null;
    mockConstants.easConfig.projectId = '00000000-0000-4000-8000-000000000010';
    mockConstants.expoConfig.extra.eas.projectId = '00000000-0000-4000-8000-000000000010';
  });

  it('creates the Android channel before requesting permission and reading the Expo token', async () => {
    const order: string[] = [];
    mockNotifications.setNotificationChannelAsync.mockImplementation(async () => {
      order.push('channel');
      return null;
    });
    mockNotifications.getPermissionsAsync.mockImplementation(async () => {
      order.push('read-permission');
      return { granted: false, status: 'undetermined' } as never;
    });
    mockNotifications.requestPermissionsAsync.mockImplementation(async () => {
      order.push('request-permission');
      return { granted: true, status: 'granted' } as never;
    });
    mockNotifications.getExpoPushTokenAsync.mockImplementation(async () => {
      order.push('token');
      return { type: 'expo', data: 'ExpoPushToken[synthetic-device-token-01]' } as never;
    });

    const permission = await requestPushPermission(notifications, runtimeConfig());
    expect(permission).toBe('GRANTED');
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
    } as never);
    expect(await getExpoPushToken(notifications, runtimeConfig())).toBe(
      'ExpoPushToken[synthetic-device-token-01]',
    );
    expect(order.indexOf('channel')).toBeLessThan(order.indexOf('request-permission'));
    expect(order.indexOf('request-permission')).toBeLessThan(order.indexOf('token'));
  });

  it.each([
    ['undetermined', false, 'NOT_REQUESTED'],
    ['denied', false, 'DENIED'],
    ['granted', true, 'GRANTED'],
  ] as const)(
    'maps OS permission %s to %s without prompting',
    async (status, granted, expected) => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ granted, status } as never);
      await expect(readPushPermission(notifications, runtimeConfig())).resolves.toBe(expected);
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    },
  );

  it.each([
    [3, 'PROVISIONAL'],
    [4, 'EPHEMERAL'],
    [2, 'GRANTED'],
  ] as const)('maps iOS authorization %s separately', async (nativeStatus, expected) => {
    mockDevice.osName = 'iOS';
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: nativeStatus === 2,
      status: nativeStatus === 2 ? 'granted' : 'undetermined',
      ios: { status: nativeStatus },
    } as never);
    await expect(readPushPermission(notifications, runtimeConfig())).resolves.toBe(expected);
  });

  it('does not prompt or ask for a token when the runtime is unsupported', async () => {
    mockDevice.isDevice = false;
    expect(getPushDeviceAvailability(runtimeConfig())).toMatchObject({
      available: false,
      reason: 'DEVICE_UNAVAILABLE',
    });
    await expect(requestPushPermission(notifications, runtimeConfig())).resolves.toBe(
      'UNAVAILABLE',
    );
    await expect(getExpoPushToken(notifications, runtimeConfig())).rejects.toMatchObject({
      code: 'DEVICE_UNAVAILABLE',
    });
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('does not request permission or return a token if project configuration is absent', async () => {
    mockConstants.easConfig.projectId = undefined;
    mockConstants.expoConfig.extra.eas.projectId = undefined;
    expect(getPushDeviceAvailability(runtimeConfig())).toMatchObject({
      available: false,
      reason: 'CONFIGURATION_UNAVAILABLE',
    });
    await expect(requestPushPermission(notifications, runtimeConfig())).resolves.toBe(
      'UNAVAILABLE',
    );
    await expect(getExpoPushToken(notifications, runtimeConfig())).rejects.toMatchObject({
      code: 'CONFIGURATION_UNAVAILABLE',
    });
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('does not fabricate a token when permission is denied or the SDK fails', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    } as never);
    await expect(getExpoPushToken(notifications, runtimeConfig())).rejects.toMatchObject({
      code: 'PERMISSION_REQUIRED',
    });

    mockNotifications.getPermissionsAsync.mockRejectedValueOnce(new Error('private SDK detail'));
    await expect(readPushPermission(notifications, runtimeConfig())).rejects.toMatchObject({
      code: 'SDK_UNAVAILABLE',
    });
  });
});
