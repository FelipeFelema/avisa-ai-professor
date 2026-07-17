import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth';
import { AUTH_THEME } from '@/theme/auth';

type EmptyClassroomStateProps = {
  onPress: () => void;
};

export function EmptyClassroomState({ onPress }: EmptyClassroomStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="school-outline" size={64} color={AUTH_THEME.colors.primary} />

      <View style={styles.textContainer}>
        <Text style={styles.title}>Você ainda não participa de nenhuma turma.</Text>

        <Text style={styles.description}>
          Entre em uma turma para acompanhar comunicados e avisos dos professores.
        </Text>
      </View>

      <AuthButton label="Ver turmas" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: AUTH_THEME.spacing.lg,
    paddingVertical: AUTH_THEME.spacing.xxxl,
  },

  textContainer: {
    alignItems: 'center',
    gap: AUTH_THEME.spacing.sm,
  },

  title: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },

  description: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
});
