import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type PushPlatform = 'ANDROID' | 'IOS';
export type PushUnavailableReason =
  'UNSUPPORTED_PLATFORM' | 'DEVICE_UNAVAILABLE' | 'CONFIGURATION_UNAVAILABLE';

export type PushRuntimeConfig = {
  available: boolean;
  platform: PushPlatform | null;
  projectId: string | null;
  reason: PushUnavailableReason | null;
};

type RuntimeInput = {
  platform: string;
  device: { isDevice?: boolean };
  constants: {
    appOwnership?: string | null;
    executionEnvironment?: string;
    easConfig?: { projectId?: string | null } | null;
    expoConfig?: {
      extra?: { eas?: { projectId?: string | null } } | null;
      android?: { package?: string | null };
      ios?: { bundleIdentifier?: string | null };
    } | null;
  };
  env: Record<string, string | undefined>;
};

export function resolvePushRuntimeConfig(input: RuntimeInput): PushRuntimeConfig {
  const platform =
    input.platform === 'android' ? 'ANDROID' : input.platform === 'ios' ? 'IOS' : null;
  if (!platform) {
    return { available: false, platform: null, projectId: null, reason: 'UNSUPPORTED_PLATFORM' };
  }

  if (
    !input.device.isDevice ||
    input.constants.appOwnership === 'expo' ||
    input.constants.executionEnvironment === 'storeClient'
  ) {
    return { available: false, platform, projectId: null, reason: 'DEVICE_UNAVAILABLE' };
  }

  const projectId =
    input.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    input.constants.easConfig?.projectId ||
    input.constants.expoConfig?.extra?.eas?.projectId ||
    null;
  const appIdentifier =
    platform === 'ANDROID'
      ? input.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID?.trim() ||
        input.constants.expoConfig?.android?.package
      : input.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER?.trim() ||
        input.constants.expoConfig?.ios?.bundleIdentifier;
  if (!projectId || !appIdentifier) {
    return { available: false, platform, projectId, reason: 'CONFIGURATION_UNAVAILABLE' };
  }

  return { available: true, platform, projectId, reason: null };
}

export function getPushRuntimeConfig(): PushRuntimeConfig {
  const detectedPlatform =
    Device.osName === 'Android' ? 'android' : Device.osName === 'iOS' ? 'ios' : Platform.OS;
  return resolvePushRuntimeConfig({
    platform: detectedPlatform,
    device: Device,
    constants: Constants,
    env: {
      EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      EXPO_PUBLIC_ANDROID_APPLICATION_ID: process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID,
      EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER,
    },
  });
}

export function resolvePushTestActionEnabled(development: boolean, configured: unknown): boolean {
  return development || configured === true;
}

export function getPushTestActionEnabled(): boolean {
  return resolvePushTestActionEnabled(__DEV__, Constants.expoConfig?.extra?.pushDiagnosticsEnabled);
}
