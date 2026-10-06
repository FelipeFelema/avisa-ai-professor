import type * as Notifications from 'expo-notifications';
import { getPushRuntimeConfig, type PushRuntimeConfig } from '@/config/push-config';

type NotificationsModule = typeof import('expo-notifications');

export type PushPermissionState =
  'NOT_REQUESTED' | 'GRANTED' | 'PROVISIONAL' | 'EPHEMERAL' | 'DENIED' | 'UNAVAILABLE';

export class PushDeviceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PushDeviceError';
  }
}

export function getPushDeviceAvailability(
  config: PushRuntimeConfig = getPushRuntimeConfig(),
): PushRuntimeConfig {
  return config;
}

function mapPermission(
  permission: Notifications.NotificationPermissionsStatus,
  config: PushRuntimeConfig,
  notifications: NotificationsModule,
): PushPermissionState {
  if (!config.available) return 'UNAVAILABLE';
  if (config.platform === 'IOS') {
    const iosStatus = permission.ios?.status;
    if (iosStatus === notifications.IosAuthorizationStatus.PROVISIONAL) return 'PROVISIONAL';
    if (iosStatus === notifications.IosAuthorizationStatus.EPHEMERAL) return 'EPHEMERAL';
    if (iosStatus === notifications.IosAuthorizationStatus.AUTHORIZED || permission.granted) {
      return 'GRANTED';
    }
    if (
      iosStatus === notifications.IosAuthorizationStatus.NOT_DETERMINED ||
      permission.status === 'undetermined'
    ) {
      return 'NOT_REQUESTED';
    }
    return 'DENIED';
  }
  if (permission.granted || permission.status === 'granted') return 'GRANTED';
  if (permission.status === 'undetermined') return 'NOT_REQUESTED';
  return 'DENIED';
}

async function loadNotifications(
  notifications?: NotificationsModule,
): Promise<NotificationsModule> {
  return notifications ?? import('expo-notifications');
}

export async function readPushPermission(
  notifications?: NotificationsModule,
  config: PushRuntimeConfig = getPushRuntimeConfig(),
): Promise<PushPermissionState> {
  if (!config.available) return 'UNAVAILABLE';
  try {
    const sdk = await loadNotifications(notifications);
    return mapPermission(await sdk.getPermissionsAsync(), config, sdk);
  } catch {
    throw new PushDeviceError('SDK_UNAVAILABLE');
  }
}

export async function requestPushPermission(
  notifications?: NotificationsModule,
  config: PushRuntimeConfig = getPushRuntimeConfig(),
): Promise<PushPermissionState> {
  if (!config.available) return 'UNAVAILABLE';

  try {
    const sdk = await loadNotifications(notifications);
    if (config.platform === 'ANDROID') {
      await sdk.setNotificationChannelAsync('push-test', {
        name: 'Notificações',
        importance: sdk.AndroidImportance.DEFAULT,
      });
    }
    const current = await sdk.getPermissionsAsync();
    const currentState = mapPermission(current, config, sdk);
    if (currentState !== 'NOT_REQUESTED') return currentState;

    const requested = await sdk.requestPermissionsAsync(
      config.platform === 'IOS'
        ? { ios: { allowAlert: true, allowSound: true, allowBadge: true } }
        : undefined,
    );
    return mapPermission(requested, config, sdk);
  } catch {
    throw new PushDeviceError('SDK_UNAVAILABLE');
  }
}

export async function getExpoPushToken(
  notifications?: NotificationsModule,
  config: PushRuntimeConfig = getPushRuntimeConfig(),
): Promise<string> {
  if (!config.available || !config.projectId) {
    throw new PushDeviceError(config.reason ?? 'CONFIGURATION_UNAVAILABLE');
  }

  const permission = await readPushPermission(notifications, config);
  if (!['GRANTED', 'PROVISIONAL', 'EPHEMERAL'].includes(permission)) {
    throw new PushDeviceError('PERMISSION_REQUIRED');
  }

  try {
    const sdk = await loadNotifications(notifications);
    const result = await sdk.getExpoPushTokenAsync({ projectId: config.projectId });
    if (!/^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{8,256}\]$/.test(result.data)) {
      throw new PushDeviceError('TOKEN_UNAVAILABLE');
    }
    return result.data;
  } catch (error) {
    if (error instanceof PushDeviceError) throw error;
    throw new PushDeviceError('TOKEN_UNAVAILABLE');
  }
}
