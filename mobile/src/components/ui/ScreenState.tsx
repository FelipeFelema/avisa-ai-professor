import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import { Button } from './Button';

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
        <Button label={actionLabel} variant="ghost" onPress={onAction} style={styles.action} />
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
  kind: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
