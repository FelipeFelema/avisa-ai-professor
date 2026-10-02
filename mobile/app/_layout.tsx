import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AppProvider } from '@/providers/AppProvider';

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigation />
    </AppProvider>
  );
}

function RootNavigation() {
  const { phase, preference, palette } = useTheme();
  const backgroundColor = palette.colors.background;

  if (phase !== 'ready') {
    return null;
  }

  return (
    <View testID="root-theme-surface" style={{ flex: 1, backgroundColor }}>
      <StatusBar style={preference === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }} />
    </View>
  );
}
