import { jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockPushNotifications = {
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getPermissionsAsync: jest.fn<() => Promise<{ granted: boolean; status: string }>>(),
  requestPermissionsAsync: jest.fn<() => Promise<{ granted: boolean; status: string }>>(),
  getExpoPushTokenAsync: jest.fn<() => Promise<{ data: string }>>(),
  getDevicePushTokenAsync: jest.fn<() => Promise<{ data: string }>>(),
  setNotificationChannelAsync: jest.fn<() => Promise<void>>(),
  setNotificationHandler: jest.fn<() => void>(),
  addNotificationReceivedListener: jest.fn<() => { remove: () => void }>(),
  addNotificationResponseReceivedListener: jest.fn<() => { remove: () => void }>(),
  addPushTokenListener: jest.fn<() => { remove: () => void }>(),
  removeNotificationSubscription: jest.fn<() => void>(),
};

const mockPushDevice = {
  isDevice: true,
  osName: 'Android',
  osVersion: 'test',
};

const mockPushConstants: {
  appOwnership: string | null;
  executionEnvironment?: string;
  easConfig: { projectId: string | undefined };
  expoConfig: { extra: { eas: { projectId: string | undefined } } };
} = {
  appOwnership: null,
  easConfig: { projectId: '00000000-0000-4000-8000-000000000010' },
  expoConfig: {
    extra: { eas: { projectId: '00000000-0000-4000-8000-000000000010' } },
  },
};

const mockPushCrypto = {
  randomUUID: jest.fn<() => string>(() => '00000000-0000-4000-8000-000000000011'),
  getRandomBytes: jest.fn<(length: number) => Uint8Array>((length) =>
    Uint8Array.from({ length }, (_, index) => index + 1),
  ),
  getRandomBytesAsync: jest.fn<(length: number) => Promise<Uint8Array>>(async (length) =>
    Uint8Array.from({ length }, (_, index) => index + 1),
  ),
  digestStringAsync: jest.fn<() => Promise<string>>(async () => 'synthetic-sha256-digest'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
};

jest.mock('expo-notifications', () => mockPushNotifications);
jest.mock('expo-device', () => mockPushDevice);
jest.mock('expo-constants', () => ({ __esModule: true, default: mockPushConstants }));
jest.mock('expo-crypto', () => mockPushCrypto);

const mockBlockedFetch = jest.fn(async () => {
  throw new Error('Unexpected network request in a mobile Jest test.');
});

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: mockBlockedFetch,
});

export const pushMocks = {
  notifications: mockPushNotifications,
  device: mockPushDevice,
  constants: mockPushConstants,
  crypto: mockPushCrypto,
  fetch: mockBlockedFetch,
};

export const pushStorageMocks = {
  secureStore: SecureStore,
  asyncStorage: AsyncStorage,
};

export function resetPushStorageMocks(): void {
  jest.mocked(SecureStore.getItemAsync).mockReset();
  jest.mocked(SecureStore.setItemAsync).mockReset();
  jest.mocked(SecureStore.deleteItemAsync).mockReset();
  jest.mocked(AsyncStorage.getItem).mockReset();
  jest.mocked(AsyncStorage.setItem).mockReset();
  jest.mocked(AsyncStorage.removeItem).mockReset();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
}

export function resetPushMocks(): void {
  [
    mockPushNotifications.getPermissionsAsync,
    mockPushNotifications.requestPermissionsAsync,
    mockPushNotifications.getExpoPushTokenAsync,
    mockPushNotifications.getDevicePushTokenAsync,
    mockPushNotifications.setNotificationChannelAsync,
    mockPushNotifications.setNotificationHandler,
    mockPushNotifications.addNotificationReceivedListener,
    mockPushNotifications.addNotificationResponseReceivedListener,
    mockPushNotifications.addPushTokenListener,
    mockPushNotifications.removeNotificationSubscription,
    mockPushCrypto.randomUUID,
    mockPushCrypto.getRandomBytes,
    mockPushCrypto.getRandomBytesAsync,
    mockPushCrypto.digestStringAsync,
  ].forEach((mock) => mock.mockReset());
  mockBlockedFetch.mockReset();
  mockPushNotifications.getPermissionsAsync.mockResolvedValue({
    granted: false,
    status: 'undetermined',
  });
  mockPushNotifications.requestPermissionsAsync.mockResolvedValue({
    granted: false,
    status: 'undetermined',
  });
  mockPushNotifications.addNotificationReceivedListener.mockReturnValue({
    remove: jest.fn(),
  });
  mockPushNotifications.addNotificationResponseReceivedListener.mockReturnValue({
    remove: jest.fn(),
  });
  mockPushNotifications.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
  mockPushNotifications.getExpoPushTokenAsync.mockResolvedValue({
    data: 'ExpoPushToken[synthetic-token-value]',
  });
  mockPushNotifications.setNotificationChannelAsync.mockResolvedValue(undefined);
  mockPushCrypto.randomUUID.mockReturnValue('00000000-0000-4000-8000-000000000011');
  mockPushCrypto.getRandomBytes.mockImplementation((length) =>
    Uint8Array.from({ length }, (_, index) => index + 1),
  );
  mockPushCrypto.getRandomBytesAsync.mockImplementation(async (length) =>
    Uint8Array.from({ length }, (_, index) => index + 1),
  );
  mockPushCrypto.digestStringAsync.mockResolvedValue('synthetic-sha256-digest');
  mockBlockedFetch.mockImplementation(async () => {
    throw new Error('Unexpected network request in a mobile Jest test.');
  });
}

beforeEach(() => {
  resetPushMocks();
  resetPushStorageMocks();
});

export function usePushFakeTimers(now = new Date('2026-01-01T00:00:00.000Z')): void {
  jest.useFakeTimers();
  jest.setSystemTime(now);
}

export async function advancePushTimersBy(milliseconds: number): Promise<void> {
  await jest.advanceTimersByTimeAsync(milliseconds);
}
