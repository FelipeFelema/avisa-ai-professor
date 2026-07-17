import { StyleSheet, Text, View } from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

type HomeHeaderProps = {
  name: string;
};

export function HomeHeader({ name }: HomeHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Olá, {name} 👋</Text>
      <Text style={styles.title}>Bem-vindo ao{'\n'}Avisa Aí Professor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: AUTH_THEME.spacing.sm,
  },
  greeting: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '600',
  },
  title: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    lineHeight: 40,
  },
});
