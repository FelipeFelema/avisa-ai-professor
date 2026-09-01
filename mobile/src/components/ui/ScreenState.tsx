import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

export type ScreenStateKind = 'loading' | 'empty' | 'error' | 'success' | 'not-found';

export type ScreenStateProps = {
  kind: ScreenStateKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ScreenState({ kind, title, message, actionLabel, onAction }: ScreenStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      <Text accessibilityElementsHidden style={styles.kind}>
        {kind}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  title: { ...theme.typography.sectionTitle, color: theme.colors.text, textAlign: 'center' },
  message: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  action: {
    minHeight: theme.targets.android,
    minWidth: theme.targets.android,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  actionText: { ...theme.typography.body, color: theme.colors.primary, fontWeight: '700' },
  kind: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
