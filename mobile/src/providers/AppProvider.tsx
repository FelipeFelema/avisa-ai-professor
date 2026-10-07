import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

import { queryClient } from '@/config';
import { useTheme } from '@/hooks/useTheme';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { PushProvider } from '@/providers/PushProvider';

type AppProviderProps = PropsWithChildren;

export function AppProvider({ children }: AppProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ReadySessionTree>{children}</ReadySessionTree>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ReadySessionTree({ children }: AppProviderProps) {
  const { phase } = useTheme();

  if (phase !== 'ready') {
    return null;
  }

  return (
    <AuthProvider>
      <PushProvider>{children}</PushProvider>
    </AuthProvider>
  );
}
