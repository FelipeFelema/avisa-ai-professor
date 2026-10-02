import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function ThemeSwitcher() {
  const { preference, setTheme } = useTheme();

  return (
    <View>
      <Text testID="active-theme">{preference}</Text>
      <Pressable accessibilityRole="button" onPress={() => setTheme('light')}>
        <Text>Select Claro</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setTheme('dark')}>
        <Text>Select Escuro</Text>
      </Pressable>
    </View>
  );
}

export function ThemeController({
  onReady,
}: {
  onReady: (setTheme: (preference: 'light' | 'dark') => void) => void;
}) {
  const { setTheme } = useTheme();

  useEffect(() => onReady(setTheme), [onReady, setTheme]);
  return null;
}
