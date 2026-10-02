import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function SplashScreen() {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.colors.background }]}>
      <Text style={{ color: palette.colors.text }}>Carregando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center' } });
