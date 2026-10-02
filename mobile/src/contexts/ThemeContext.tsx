import { createContext } from 'react';

import type { Theme } from '@/theme';

export type ThemePreference = 'light' | 'dark';
export type ThemePhase = 'restoring' | 'ready';

export interface ThemeContextValue {
  phase: ThemePhase;
  preference: ThemePreference;
  palette: Theme;
  setTheme: (preference: ThemePreference) => void;
  persistenceWarning: string | null;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
