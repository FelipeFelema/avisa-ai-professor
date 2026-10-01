import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  leadingIcon?: IoniconName;
};

export function FormField({
  label,
  error,
  helperText,
  leadingIcon,
  accessibilityLabel,
  style,
  ...inputProps
}: FormFieldProps) {
  const describedBy = error ? `${label}-error` : helperText ? `${label}-helper` : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {leadingIcon ? (
          <Ionicons
            testID="form-field-leading-icon"
            name={leadingIcon}
            size={20}
            color={theme.colors.textMuted}
            accessible={false}
          />
        ) : null}
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: inputProps.editable === false }}
          accessibilityHint={error ?? helperText ?? describedBy}
          style={[styles.input, leadingIcon && styles.inputWithLeadingIcon, style]}
        />
      </View>
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
  inputContainer: {
    minHeight: theme.targets.android,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    minHeight: theme.targets.android,
    paddingHorizontal: 0,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  inputWithLeadingIcon: { marginLeft: theme.spacing.xs },
  inputError: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSubtle },
  helper: { ...theme.typography.caption, color: theme.colors.textMuted },
  error: { ...theme.typography.caption, color: theme.colors.danger },
});
