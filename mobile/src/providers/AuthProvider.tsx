import { PropsWithChildren, useMemo, useState } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData, AuthUser } from '@/types/auth';

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading] = useState(false);

  async function login() {}

  async function logout() {
    setUser(null);
  }

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
