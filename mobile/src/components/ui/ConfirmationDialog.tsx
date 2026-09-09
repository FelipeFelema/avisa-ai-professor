import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

export type ConfirmationSummaryRow = { label: string; value: string };

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  targetLabel: string;
  summary?: ConfirmationSummaryRow[];
  consequence?: string;
  variant?: 'neutral' | 'destructive';
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  errorMessage?: string;
};

export function ConfirmationDialog({
  visible,
  title,
  targetLabel,
  summary = [],
  consequence,
  variant = 'neutral',
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  onCancel,
  onConfirm,
  pending = false,
  errorMessage,
}: ConfirmationDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessibilityViewIsModal
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.target}>{targetLabel}</Text>
          {summary.map((row) => (
            <Text key={row.label} style={styles.row}>
              {row.label}: {row.value}
            </Text>
          ))}
          {consequence ? <Text style={styles.consequence}>{consequence}</Text> : null}
          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorMessage}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={onCancel}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending, busy: pending }}
              disabled={pending}
              onPress={onConfirm}
              style={[styles.confirm, variant === 'destructive' && styles.destructive]}
            >
              <Text style={styles.confirmText}>{pending ? 'Aguarde...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.backdrop,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  title: { ...theme.typography.sectionTitle, color: theme.colors.text },
  target: { ...theme.typography.body, color: theme.colors.text, fontWeight: '700' },
  row: { ...theme.typography.body, color: theme.colors.textMuted },
  consequence: { ...theme.typography.body, color: theme.colors.danger },
  error: { ...theme.typography.caption, color: theme.colors.danger },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cancel: {
    minHeight: theme.targets.android,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  cancelText: { ...theme.typography.body, color: theme.colors.primary, fontWeight: '700' },
  confirm: {
    minHeight: theme.targets.android,
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
  },
  destructive: { backgroundColor: theme.colors.danger },
  confirmText: { ...theme.typography.body, color: theme.colors.onPrimary, fontWeight: '700' },
});
