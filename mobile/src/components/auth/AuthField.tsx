import { ReactNode } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: ReactNode;
  inputStyle?: StyleProp<TextStyle>;
};

export function AuthField({
  label,
  error,
  helperText,
  style,
  inputStyle,
  ...props
}: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        placeholderTextColor={AUTH_THEME.colors.muted}
        style={[styles.input, error ? styles.inputError : null, style, inputStyle]}
        {...props}
      />

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: AUTH_THEME.spacing.xs,
  },
  label: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.label,
    fontWeight: '700',
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    borderRadius: AUTH_THEME.radius.md,
    backgroundColor: AUTH_THEME.colors.surfaceSoft,
    paddingHorizontal: AUTH_THEME.spacing.md,
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
  },
  inputError: {
    borderColor: AUTH_THEME.colors.error,
    backgroundColor: AUTH_THEME.colors.errorSoft,
  },
  helper: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 18,
  },
  error: {
    color: AUTH_THEME.colors.error,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 18,
  },
});
