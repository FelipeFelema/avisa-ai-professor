import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, RenderOptions } from '@testing-library/react-native';
import { PropsWithChildren, ReactElement } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextData } from '@/types/auth';
import { ThemeProvider } from '@/providers/ThemeProvider';

const testClients = new Set<QueryClient>();

afterEach(async () => {
  await cleanup();
  for (const client of testClients) {
    await client.cancelQueries();
    client.clear();
  }
  testClients.clear();
});

export function createTestQueryClient() {
  const client = new QueryClient({
    // Native Jest supplies window, so Query uses browser GC timers (five minutes).
    // Tests dispose caches explicitly; pending mocked mutations must not poll GC.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  testClients.add(client);
  return client;
}

const defaultAuthContext: AuthContextData = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
  applyProfileUpdate: () => undefined,
  expireSession: async () => undefined,
  sessionStorageRecoveryRequired: false,
  retrySessionCleanup: async () => true,
};

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient; auth?: Partial<AuthContextData> } = {},
) {
  const { queryClient = createTestQueryClient(), auth, ...renderOptions } = options;
  testClients.add(queryClient);
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthContext.Provider value={{ ...defaultAuthContext, ...auth }}>
          {children}
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
