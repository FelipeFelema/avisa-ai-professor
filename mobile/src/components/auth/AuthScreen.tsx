import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AUTH_THEME } from '@/theme/auth';

type AuthScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthScreen({ eyebrow, title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{eyebrow}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.content}>{children}</View>
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },
  backgroundBlobTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: AUTH_THEME.colors.primarySoft,
    opacity: 0.72,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: '#E7E3DA',
    opacity: 0.55,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: AUTH_THEME.spacing.xl,
    paddingVertical: AUTH_THEME.spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.xl,
    padding: AUTH_THEME.spacing.xxl,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: AUTH_THEME.colors.primarySoft,
    borderRadius: AUTH_THEME.radius.pill,
    paddingHorizontal: AUTH_THEME.spacing.md,
    paddingVertical: AUTH_THEME.spacing.xs,
    marginBottom: AUTH_THEME.spacing.md,
  },
  badgeText: {
    color: AUTH_THEME.colors.primaryDark,
    fontSize: AUTH_THEME.typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 40,
  },
  subtitle: {
    marginTop: AUTH_THEME.spacing.sm,
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },
  content: {
    marginTop: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.lg,
  },
  footer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: AUTH_THEME.spacing.lg,
  },
});
