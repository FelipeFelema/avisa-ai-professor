import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ThemeContext } from '@/contexts/ThemeContext';
import type { ThemePhase, ThemePreference } from '@/contexts/ThemeContext';
import { loadThemePreference, saveThemePreference } from '@/storage/theme.storage';
import { darkTheme, lightTheme } from '@/theme';

type ThemeProviderProps = PropsWithChildren;

const PERSISTENCE_WARNING =
  'A aparência mudou, mas a preferência pode não permanecer após fechar o aplicativo.';

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [phase, setPhase] = useState<ThemePhase>('restoring');
  const [preference, setPreference] = useState<ThemePreference>('light');
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const palette = preference === 'dark' ? darkTheme : lightTheme;
  const preferenceRef = useRef<ThemePreference>('light');
  const selectionVersionRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;

    void loadThemePreference()
      .then((storedPreference) => {
        if (!mounted) return;

        preferenceRef.current = storedPreference;
        setPreference(storedPreference);
        setPhase('ready');
      })
      .catch(() => {
        if (!mounted) return;

        preferenceRef.current = 'light';
        setPreference('light');
        setPhase('ready');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback((nextPreference: ThemePreference) => {
    if (preferenceRef.current === nextPreference) {
      return;
    }

    preferenceRef.current = nextPreference;
    setPreference(nextPreference);
    setPersistenceWarning(null);

    const selectionVersion = ++selectionVersionRef.current;

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => saveThemePreference(nextPreference))
      .catch(() => {
        if (selectionVersionRef.current === selectionVersion) {
          setPersistenceWarning(PERSISTENCE_WARNING);
        }
      });
  }, []);

  const value = useMemo(
    () => ({ phase, preference, palette, setTheme, persistenceWarning }),
    [phase, preference, palette, setTheme, persistenceWarning],
  );

  return (
    <ThemeContext.Provider value={value}>
      {phase === 'ready' ? children : null}
    </ThemeContext.Provider>
  );
}
