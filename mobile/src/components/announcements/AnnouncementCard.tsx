import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getClassroomAnnouncementExpirationLabel } from '@/lib/classroom-expiration';
import { theme } from '@/theme';

type AnnouncementCardProps = {
  title: string;
  content: string;
  author: string;
  expiresAt?: string | null;
  onPress?: () => void;
};

export function AnnouncementCard({
  title,
  content,
  author,
  expiresAt,
  onPress,
}: AnnouncementCardProps) {
  const expirationLabel = getClassroomAnnouncementExpirationLabel(expiresAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Abrir comunicado ${title}` : undefined}
      accessibilityHint={onPress ? 'Abre o comunicado completo.' : undefined}
      accessible={Boolean(onPress)}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.author}>Professor • {author}</Text>
      </View>

      <Text numberOfLines={3} style={styles.content}>
        {content}
      </Text>

      {expirationLabel ? (
        <View style={styles.footer}>
          <Text style={styles.expirationLabel}>{expirationLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: theme.targets.android,
    minHeight: theme.targets.android,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,

    shadowColor: theme.colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  cardPressed: {
    opacity: 0.92,
  },

  header: {
    gap: theme.spacing.xs,
  },

  title: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text,
  },

  author: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },

  content: {
    color: theme.colors.text,
    ...theme.typography.body,
    lineHeight: 24,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  expirationLabel: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
    fontWeight: '700',
  },
});
