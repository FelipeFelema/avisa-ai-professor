import { Pressable, PressableProps, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '@/theme';

type AuthButtonProps = PressableProps & {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AuthButton({
  label,
  loadingLabel,
  isLoading = false,
  disabled,
  accessibilityLabel,
  accessibilityRole: _accessibilityRole,
  accessibilityState: _accessibilityState,
  style,
  ...props
}: AuthButtonProps) {
  const buttonLabel = isLoading && loadingLabel ? loadingLabel : label;
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? buttonLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled ? styles.buttonPressed : null,
        style,
      ]}
    >
      <Text style={styles.label}>{buttonLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.targets.android,
    minWidth: theme.targets.android,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    shadowColor: theme.colors.primaryPressed,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: theme.colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  label: {
    color: theme.colors.onPrimary,
    ...theme.typography.body,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
