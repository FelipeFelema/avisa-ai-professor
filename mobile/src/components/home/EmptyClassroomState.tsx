import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { theme } from '@/theme';

type EmptyClassroomStateProps = {
  title?: string;
  description?: string;
  onPress?: () => void;
};

export function EmptyClassroomState({
  title = 'Você ainda não participa de nenhuma turma.',
  description = 'Entre em uma turma para acompanhar comunicados e avisos dos professores.',
  onPress,
}: EmptyClassroomStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Ionicons name="school-outline" size={64} color={theme.colors.primary} accessible={false} />

      <View style={styles.textContainer}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>

        <Text style={styles.description}>{description}</Text>
      </View>

      {onPress ? <Button label="Ver turmas" onPress={onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.xxxl,
  },

  textContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '100%',
  },

  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    width: '100%',
    flexShrink: 1,
    textAlign: 'center',
  },

  description: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    width: '100%',
    flexShrink: 1,
    textAlign: 'center',
  },
});
