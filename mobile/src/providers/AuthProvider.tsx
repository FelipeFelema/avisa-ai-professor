import { PropsWithChildren, useMemo, useState, useEffect } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData, AuthUser, LoginRequest } from '@/types/auth';
import * as authService from '@/services/auth';
import { saveTokens, clearTokens, getTokens } from '@/storage';

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function login(data: LoginRequest): Promise<void> {
    setIsLoading(true);

    try {
      // Authenticate the user and retrieve JWT tokens from the backend.
      const tokens = await authService.login(data);

      // Persist the authentication session on the device.
      await saveTokens(tokens);

      // Retrieve the authenticated user's profile.
      const user = await authService.getProfile();

      // Update the global authentication state.
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    // Remove the persisted authentication session.
    await clearTokens();

    // Clear the authenticated user from the application state.
    setUser(null);
  }

  async function restoreSession(): Promise<void> {
    try {
      // Retrieve any persisted authentication session from the device.
      const tokens = await getTokens();

      if (!tokens) {
        return;
      }

      // Retrieve the authenticated user's profile from the backend.
      const profile = await authService.getProfile();

      // Restore the authenticated user into the application state.
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void restoreSession();
  }, []);

  const value = useMemo<AuthContextData>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
