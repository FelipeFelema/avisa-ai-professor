import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

export type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
};

export function FormField({
  label,
  error,
  helperText,
  accessibilityLabel,
  ...props
}: FormFieldProps) {
  const describedBy = error ? `${label}-error` : helperText ? `${label}-helper` : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        accessibilityHint={describedBy}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? (
        <Text nativeID={`${label}-error`} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!error && helperText ? (
        <Text nativeID={`${label}-helper`} style={styles.helper}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  label: { ...theme.typography.label, color: theme.colors.text },
  input: {
    minHeight: theme.targets.android,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  inputError: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSubtle },
  helper: { ...theme.typography.caption, color: theme.colors.textMuted },
  error: { ...theme.typography.caption, color: theme.colors.danger },
});
