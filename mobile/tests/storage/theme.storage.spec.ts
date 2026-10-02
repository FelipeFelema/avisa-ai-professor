import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storage';
import { clearTokens } from '@/storage/auth.storage';
import { loadThemePreference, saveThemePreference } from '@/storage/theme.storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockSetItem = jest.mocked(AsyncStorage.setItem);
const mockGetItem = jest.mocked(AsyncStorage.getItem);
const mockRemoveItem = jest.mocked(AsyncStorage.removeItem);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('theme preference storage writes', () => {
  it('uses a separate key from authentication tokens', async () => {
    await saveThemePreference('dark');

    expect(STORAGE_KEYS.themePreference).toEqual(expect.any(String));
    expect(STORAGE_KEYS.themePreference).not.toBe(STORAGE_KEYS.accessToken);
    expect(STORAGE_KEYS.themePreference).not.toBe(STORAGE_KEYS.refreshToken);
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.themePreference, 'dark');
  });

  it('writes only the raw light and dark preference strings', async () => {
    await saveThemePreference('light');
    await saveThemePreference('dark');

    expect(mockSetItem.mock.calls.map(([, value]) => value)).toEqual(['light', 'dark']);
  });

  it('resolves after a successful local write', async () => {
    await expect(saveThemePreference('light')).resolves.toBeUndefined();
  });

  it('propagates a rejected local write for the provider to report', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(saveThemePreference('dark')).rejects.toThrow('storage unavailable');
  });

  it('does not remove the theme preference when authentication tokens are cleared', async () => {
    await clearTokens();

    expect(mockRemoveItem).not.toHaveBeenCalled();
  });
});

describe('theme preference storage restoration', () => {
  it.each(['light', 'dark'] as const)('restores the saved %s preference', async (preference) => {
    mockGetItem.mockResolvedValueOnce(preference);

    await expect(loadThemePreference()).resolves.toBe(preference);
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEYS.themePreference);
  });

  it.each([null, 'sepia', '', '{corrupt'])(
    'falls back to light for stored value %s',
    async (value) => {
      mockGetItem.mockResolvedValueOnce(value);

      await expect(loadThemePreference()).resolves.toBe('light');
    },
  );

  it('falls back to light when reading storage rejects', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadThemePreference()).resolves.toBe('light');
  });
});
