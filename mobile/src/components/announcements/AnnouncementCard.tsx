import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

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
      backgroundColor: AUTH_THEME.colors.primarySoft,
      textColor: AUTH_THEME.colors.primaryDark,
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
      backgroundColor: AUTH_THEME.colors.errorSoft,
      textColor: AUTH_THEME.colors.error,
    };
  }

  if (differenceInDays <= 3) {
    return {
      label: `🕒 Expira em ${differenceInDays} dias`,
      backgroundColor: '#FFF4E5',
      textColor: '#B54708',
    };
  }

  if (differenceInDays <= 7) {
    return {
      label: `🕒 Expira em ${differenceInDays} dias`,
      backgroundColor: '#FFF8DB',
      textColor: '#B58900',
    };
  }

  return {
    label: `🕒 Expira em ${differenceInDays} dias`,
    backgroundColor: AUTH_THEME.colors.primarySoft,
    textColor: AUTH_THEME.colors.primaryDark,
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
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.lg,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.lg,

    shadowColor: '#000',
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
    gap: AUTH_THEME.spacing.xs,
  },

  title: {
    color: AUTH_THEME.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  author: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
  },

  content: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 24,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AUTH_THEME.radius.pill,
  },

  badgeText: {
    fontSize: AUTH_THEME.typography.caption,
    fontWeight: '700',
  },
});
