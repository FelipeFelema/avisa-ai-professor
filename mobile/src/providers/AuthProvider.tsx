import { PropsWithChildren, useMemo, useState, useEffect, useCallback } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import type {
  AuthContextData,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  SessionCleanupOutcome,
} from '@/types/auth';
import * as authService from '@/services/auth';
import { saveTokens, clearTokens, getTokens } from '@/storage';
import { announcementKeys, authKeys, classroomKeys, queryClient } from '@/config';
import {
  getSessionGeneration,
  invalidateSessionGeneration,
  isSessionGenerationCurrent,
  setSessionExpiredHandler,
  SessionGenerationChangedError,
} from '@/lib';

type AuthProviderProps = PropsWithChildren;

const failedCleanup: SessionCleanupOutcome = {
  accessTokenRemoved: false,
  refreshTokenRemoved: false,
  complete: false,
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStorageRecoveryRequired, setSessionStorageRecoveryRequired] = useState(false);

  const clearSessionState = useCallback(async (expectedGeneration?: number) => {
    if (expectedGeneration !== undefined && !isSessionGenerationCurrent(expectedGeneration)) {
      return failedCleanup;
    }

    // Invalidate first so pending requests and token writes cannot revive this session.
    const cleanupGeneration = invalidateSessionGeneration();
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setIsLoading(false);

    const outcome = (await clearTokens(cleanupGeneration)) ?? failedCleanup;
    setSessionStorageRecoveryRequired(!outcome.complete);
    return outcome;
  }, []);

  const expireSession = useCallback(
    async (generation?: number) => clearSessionState(generation),
    [clearSessionState],
  );

  const retrySessionCleanup = useCallback(async () => {
    const outcome = await clearSessionState();
    return outcome.complete;
  }, [clearSessionState]);

  const applyProfileUpdate = useCallback(
    (profile: AuthUser, generation = getSessionGeneration()) => {
      if (!isSessionGenerationCurrent(generation)) return;
      setUser(profile);
      queryClient.setQueryData(authKeys.profile(), profile);

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: authKeys.profile() }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.available() }),
        queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
      ]);
    },
    [],
  );

  const createSession = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }, generation: number) => {
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
      const saved = await saveTokens(tokens, generation);
      if (!saved) {
        if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
        setSessionStorageRecoveryRequired(true);
        throw new Error('Não foi possível salvar a sessão neste dispositivo.');
      }

      const profile = await authService.getProfile({ sessionGeneration: generation });
      if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
      setSessionStorageRecoveryRequired(false);
      setUser(profile);
    },
    [],
  );

  useEffect(() => {
    setSessionExpiredHandler(async (generation) => {
      await clearSessionState(generation);
    });

    return () => {
      setSessionExpiredHandler(undefined);
    };
  }, [clearSessionState]);

  const login = useCallback(
    async (data: LoginRequest): Promise<void> => {
      const generation = getSessionGeneration();
      setIsLoading(true);

      try {
        const tokens = await authService.login(data);
        if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
        await createSession(tokens, generation);
      } catch (error) {
        if (isSessionGenerationCurrent(generation)) await clearSessionState(generation);
        throw error;
      } finally {
        if (isSessionGenerationCurrent(generation)) setIsLoading(false);
      }
    },
    [clearSessionState, createSession],
  );

  const register = useCallback(
    async (data: RegisterRequest): Promise<void> => {
      const generation = getSessionGeneration();
      setIsLoading(true);

      try {
        const tokens = await authService.register(data);
        if (!isSessionGenerationCurrent(generation)) throw new SessionGenerationChangedError();
        await createSession(tokens, generation);
      } catch (error) {
        if (isSessionGenerationCurrent(generation)) await clearSessionState(generation);
        throw error;
      } finally {
        if (isSessionGenerationCurrent(generation)) setIsLoading(false);
      }
    },
    [clearSessionState, createSession],
  );

  const logout = useCallback(async () => {
    await clearSessionState();
  }, [clearSessionState]);

  useEffect(() => {
    let cancelled = false;
    const generation = getSessionGeneration();

    void (async () => {
      try {
        const tokens = await getTokens(generation);
        if (!isSessionGenerationCurrent(generation)) return;
        if (!tokens) {
          await clearSessionState(generation);
          return;
        }

        const profile = await authService.getProfile({ sessionGeneration: generation });
        if (!cancelled && isSessionGenerationCurrent(generation)) setUser(profile);
      } catch {
        if (isSessionGenerationCurrent(generation)) await clearSessionState(generation);
      } finally {
        if (!cancelled && isSessionGenerationCurrent(generation)) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSessionState]);

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
      sessionStorageRecoveryRequired,
      retrySessionCleanup,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      applyProfileUpdate,
      expireSession,
      sessionStorageRecoveryRequired,
      retrySessionCleanup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
