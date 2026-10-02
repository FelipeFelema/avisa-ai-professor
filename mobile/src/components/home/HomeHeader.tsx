import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { getAuthTheme } from '@/theme/auth';

type HomeHeaderProps = {
  name: string;
};

export function HomeHeader({ name }: HomeHeaderProps) {
  const { palette: theme } = useTheme();
  const AUTH_THEME = getAuthTheme(theme);
  const styles = createStyles(AUTH_THEME);

  return (
    <View accessible accessibilityRole="header" style={styles.container}>
      <Text style={styles.greeting}>Olá, {name} 👋</Text>
      <Text style={styles.title}>Bem-vindo ao Avisa Aí Professor</Text>
    </View>
  );
}

function createStyles(AUTH_THEME: ReturnType<typeof getAuthTheme>) {
  return StyleSheet.create({
    container: {
      width: '100%',
      gap: AUTH_THEME.spacing.sm,
    },
    greeting: {
      color: AUTH_THEME.colors.muted,
      fontSize: AUTH_THEME.typography.body,
      fontWeight: '600',
      flexShrink: 1,
    },
    title: {
      color: AUTH_THEME.colors.text,
      fontSize: AUTH_THEME.typography.title,
      fontWeight: '800',
      lineHeight: AUTH_THEME.typography.title + AUTH_THEME.spacing.xs,
      flexShrink: 1,
    },
  });
}
