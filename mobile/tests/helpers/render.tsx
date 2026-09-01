import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react-native';
import { PropsWithChildren, ReactElement } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData } from '@/types/auth';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const defaultAuthContext: AuthContextData = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
};

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient; auth?: Partial<AuthContextData> } = {},
) {
  const { queryClient = createTestQueryClient(), auth, ...renderOptions } = options;
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ ...defaultAuthContext, ...auth }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
