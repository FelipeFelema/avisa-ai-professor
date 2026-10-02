import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storage';
import type { ThemePreference } from '@/contexts/ThemeContext';

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.themePreference, preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const preference = await AsyncStorage.getItem(STORAGE_KEYS.themePreference);

    return preference === 'light' || preference === 'dark' ? preference : 'light';
  } catch {
    return 'light';
  }
}
