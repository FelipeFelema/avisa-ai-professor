import { Pressable, PressableProps, StyleSheet, Text, ViewStyle } from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

type AuthButtonProps = PressableProps & {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  style?: ViewStyle;
};

export function AuthButton({
  label,
  loadingLabel,
  isLoading = false,
  disabled,
  style,
  ...props
}: AuthButtonProps) {
  const buttonLabel = isLoading && loadingLabel ? loadingLabel : label;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.button,
        (disabled || isLoading) && styles.buttonDisabled,
        pressed && !(disabled || isLoading) ? styles.buttonPressed : null,
        style,
      ]}
      {...props}
    >
      <Text style={styles.label}>{buttonLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: AUTH_THEME.radius.md,
    backgroundColor: AUTH_THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: AUTH_THEME.spacing.lg,
    shadowColor: AUTH_THEME.colors.primaryDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: AUTH_THEME.colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  label: {
    color: AUTH_THEME.colors.white,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
