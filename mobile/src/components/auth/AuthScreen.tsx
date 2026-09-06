import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

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

          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
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
    backgroundColor: theme.colors.background,
  },
  backgroundBlobTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: theme.colors.primarySubtle,
    opacity: 0.72,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: theme.colors.surfaceMuted,
    opacity: 0.55,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xxl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primarySubtle,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  badgeText: {
    color: theme.colors.primaryPressed,
    ...theme.typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    ...theme.typography.title,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    ...theme.typography.body,
  },
  content: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  footer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: theme.spacing.lg,
  },
});
