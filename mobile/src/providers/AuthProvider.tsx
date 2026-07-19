import { PropsWithChildren, useMemo, useState, useEffect, useCallback } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';
import * as authService from '@/services/auth';
import { saveTokens, clearTokens, getTokens } from '@/storage';

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const createSession = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      await saveTokens(tokens);

      const profile = await authService.getProfile();

      setUser(profile);
    },
    [],
  );

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
    // Remove the persisted authentication session.
    await clearTokens();

    // Clear the authenticated user from the application state.
    setUser(null);
  }, []);

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
        await clearTokens();

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
  }, []);

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
