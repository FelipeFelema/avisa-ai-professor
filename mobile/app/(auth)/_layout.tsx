import { Redirect, Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { palette } = useTheme();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.colors.background },
      }}
    />
  );
}
