import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { theme } from '@/theme';

type ClassroomCardProps = {
  name: string;
  teacher: string;
  lastAnnouncement?: string;

  actionVariant?: 'primary' | 'danger';

  actionLabel?: string;
  onActionPress?: () => void;

  onPress?: () => void;
};

export function ClassroomCard({
  name,
  teacher,
  lastAnnouncement,
  actionVariant = 'primary',
  actionLabel,
  onActionPress,
  onPress,
}: ClassroomCardProps) {
  const cardContent = (
    <>
      <Text style={styles.name}>{name}</Text>

      <Text style={styles.teacher}>Professor: {teacher}</Text>

      <View style={styles.separator} />

      <Text style={styles.label}>Último comunicado</Text>

      <Text style={styles.announcement}>{lastAnnouncement ?? 'Nenhum comunicado disponível.'}</Text>
    </>
  );

  return (
    <View style={styles.card}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir turma ${name}`}
          style={({ pressed }) => [styles.cardContent, pressed && styles.cardPressed]}
          onPress={onPress}
        >
          {cardContent}
        </Pressable>
      ) : (
        <View style={styles.cardContent}>{cardContent}</View>
      )}

      {actionLabel && onActionPress ? (
        <Button
          label={actionLabel}
          accessibilityLabel={`${actionLabel}: ${name}`}
          style={styles.actionButton}
          variant={actionVariant === 'danger' ? 'destructive' : 'primary'}
          onPress={onActionPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,

    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },

  cardContent: {
    minHeight: theme.targets.android,
    minWidth: theme.targets.android,
    gap: theme.spacing.sm,
  },

  cardPressed: {
    opacity: 0.9,
  },

  name: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text,
  },

  teacher: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },

  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },

  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },

  announcement: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },

  actionButton: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.md,
  },
});
