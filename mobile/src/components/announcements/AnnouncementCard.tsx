import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type AnnouncementCardProps = {
  title: string;
  content: string;
  author: string;
  expiresAt?: string;
  onPress?: () => void;
};

type ExpirationBadge = {
  label: string;
  backgroundColor: string;
  textColor: string;
};

function getExpirationBadge(expiresAt?: string): ExpirationBadge {
  if (!expiresAt) {
    return {
      label: 'Comunicado ativo',
      backgroundColor: theme.colors.primarySubtle,
      textColor: theme.colors.primaryPressed,
    };
  }

  const today = new Date();
  const expiration = new Date(expiresAt);

  today.setHours(0, 0, 0, 0);
  expiration.setHours(0, 0, 0, 0);

  const differenceInDays = Math.ceil(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (differenceInDays <= 1) {
    return {
      label: differenceInDays <= 0 ? '🕒 Expira hoje' : '🕒 Expira amanhã',
      backgroundColor: theme.colors.dangerSubtle,
      textColor: theme.colors.danger,
    };
  }

  if (differenceInDays <= 3) {
    return {
      label: `🕒 Expira em ${differenceInDays} dias`,
      backgroundColor: theme.colors.surfaceMuted,
      textColor: theme.colors.warning,
    };
  }

  if (differenceInDays <= 7) {
    return {
      label: `🕒 Expira em ${differenceInDays} dias`,
      backgroundColor: theme.colors.surfaceMuted,
      textColor: theme.colors.warning,
    };
  }

  return {
    label: `🕒 Expira em ${differenceInDays} dias`,
    backgroundColor: theme.colors.primarySubtle,
    textColor: theme.colors.primaryPressed,
  };
}

export function AnnouncementCard({
  title,
  content,
  author,
  expiresAt,
  onPress,
}: AnnouncementCardProps) {
  const expirationBadge = getExpirationBadge(expiresAt);
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

      <View style={styles.footer}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: expirationBadge.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: expirationBadge.textColor,
              },
            ]}
          >
            {expirationBadge.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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

  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
  },

  badgeText: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
});
