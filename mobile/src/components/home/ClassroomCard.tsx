import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

type ClassroomCardProps = {
  name: string;
  teacher: string;
  lastAnnouncement?: string | null;
  onPress?: () => void;
};

export function ClassroomCard({ name, teacher, lastAnnouncement, onPress }: ClassroomCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={onPress}
    >
      <Text style={styles.name}>{name}</Text>

      <Text style={styles.teacher}>Professor: {teacher}</Text>

      <View style={styles.separator} />

      <Text style={styles.label}>Último comunicado</Text>

      <Text style={styles.announcement}>{lastAnnouncement ?? 'Nenhum comunicado disponível.'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.lg,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.lg,
    gap: AUTH_THEME.spacing.sm,

    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.9,
  },

  name: {
    fontSize: 18,
    fontWeight: '700',
    color: AUTH_THEME.colors.text,
  },

  teacher: {
    fontSize: AUTH_THEME.typography.body,
    color: AUTH_THEME.colors.muted,
  },

  separator: {
    height: 1,
    backgroundColor: AUTH_THEME.colors.border,
    marginVertical: AUTH_THEME.spacing.xs,
  },

  label: {
    fontSize: AUTH_THEME.typography.label,
    fontWeight: '700',
    color: AUTH_THEME.colors.text,
  },

  announcement: {
    color: AUTH_THEME.colors.muted,
    lineHeight: 20,
  },
});
