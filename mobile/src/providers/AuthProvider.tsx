import { PropsWithChildren, useMemo, useState, useEffect, useCallback } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';
import * as authService from '@/services/auth';
import { saveTokens, clearTokens, getTokens } from '@/storage';
import { announcementKeys, authKeys, classroomKeys, queryClient } from '@/config';
import { setSessionExpiredHandler } from '@/lib';

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSessionState = useCallback(async (tokensAlreadyCleared = false) => {
    if (!tokensAlreadyCleared) {
      await clearTokens();
    }

    queryClient.clear();
    setUser(null);
  }, []);

  const expireSession = useCallback(async () => clearSessionState(), [clearSessionState]);

  const applyProfileUpdate = useCallback((profile: AuthUser) => {
    setUser(profile);
    queryClient.setQueryData(authKeys.profile(), profile);

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: authKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
      queryClient.invalidateQueries({ queryKey: classroomKeys.available() }),
      queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
    ]);
  }, []);

  const createSession = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      await saveTokens(tokens);

      const profile = await authService.getProfile();

      setUser(profile);
    },
    [],
  );

  useEffect(() => {
    setSessionExpiredHandler(() => clearSessionState(true));

    return () => {
      setSessionExpiredHandler(undefined);
    };
  }, [clearSessionState]);

  const login = useCallback(
    async (data: LoginRequest): Promise<void> => {
      setIsLoading(true);

      try {
        const tokens = await authService.login(data);
        await createSession(tokens);
      } finally {
        setIsLoading(false);
      }
    },
    [createSession],
  );

  const register = useCallback(
    async (data: RegisterRequest): Promise<void> => {
      setIsLoading(true);

      try {
        const tokens = await authService.register(data);
        await createSession(tokens);
      } finally {
        setIsLoading(false);
      }
    },
    [createSession],
  );

  const logout = useCallback(async () => {
    await expireSession();
  }, [expireSession]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Retrieve any persisted authentication session from the device.
        const tokens = await getTokens();

        if (!tokens) {
          return;
        }

        // Retrieve the authenticated user's profile from the backend.
        const profile = await authService.getProfile();

        if (!cancelled) {
          // Restore the authenticated user into the application state.
          setUser(profile);
        }
      } catch {
        await expireSession();

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expireSession]);

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      applyProfileUpdate,
      expireSession,
    }),
    [user, isLoading, login, register, logout, applyProfileUpdate, expireSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
