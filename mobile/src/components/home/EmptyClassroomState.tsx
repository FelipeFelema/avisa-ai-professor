import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { theme } from '@/theme';

type EmptyClassroomStateProps = {
  onPress?: () => void;
};

export function EmptyClassroomState({ onPress }: EmptyClassroomStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Ionicons name="school-outline" size={64} color={theme.colors.primary} />

      <View style={styles.textContainer}>
        <Text accessibilityRole="header" style={styles.title}>
          Você ainda não participa de nenhuma turma.
        </Text>

        <Text style={styles.description}>
          Entre em uma turma para acompanhar comunicados e avisos dos professores.
        </Text>
      </View>

      {onPress ? <Button label="Ver turmas" onPress={onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.xxxl,
  },

  textContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
  },

  description: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
