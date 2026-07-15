import { Redirect, Stack } from 'expo-router';

import { SplashScreen } from '@/components/SplashScreen';
import { useAuth } from '@/hooks/useAuth';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
