import { ReactNode, useState } from 'react';
import {
  BlurEvent,
  FocusEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

import { theme } from '@/theme';

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
  const [isFocused, setIsFocused] = useState(false);
  const accessibilityHint = error ?? (typeof helperText === 'string' ? helperText : undefined);

  const handleFocus = (event: FocusEvent) => {
    setIsFocused(true);
    props.onFocus?.(event);
  };

  const handleBlur = (event: BlurEvent) => {
    setIsFocused(false);
    props.onBlur?.(event);
  };

  return (
    <View style={styles.field}>
      <Text nativeID={`${label}-label`} style={styles.label}>
        {label}
      </Text>

      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        accessibilityHint={accessibilityHint}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          isFocused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          style,
          inputStyle,
        ]}
      />

      {helperText ? (
        <Text nativeID={`${label}-helper`} style={styles.helper}>
          {helperText}
        </Text>
      ) : null}
      {error ? (
        <Text nativeID={`${label}-error`} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.text,
    ...theme.typography.label,
  },
  input: {
    minHeight: theme.targets.android,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSubtle,
  },
  helper: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  error: {
    color: theme.colors.danger,
    ...theme.typography.caption,
  },
});
