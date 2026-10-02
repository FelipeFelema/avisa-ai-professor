import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

export type BackButtonProps = Omit<
  PressableProps,
  'accessibilityLabel' | 'accessibilityRole' | 'onPress' | 'style'
> & {
  fallbackHref: Href;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ fallbackHref, style, ...pressableProps }: BackButtonProps) {
  const { palette: theme } = useTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const navigationLocked = useRef(false);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);

  function handlePress() {
    if (navigationLocked.current) {
      return;
    }

    navigationLocked.current = true;
    setIsNavigationLocked(true);

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  }

  return (
    <Pressable
      {...pressableProps}
      disabled={isNavigationLocked}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      accessibilityState={{ disabled: isNavigationLocked }}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null, style]}
    >
      <Ionicons
        testID="back-button-icon"
        accessibilityElementsHidden
        name="arrow-back"
        size={20}
        color={theme.colors.primary}
      />
      <Text style={styles.label}>Voltar</Text>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    button: {
      minHeight: theme.targets.android,
      minWidth: theme.targets.android,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.sm,
    },
    pressed: { opacity: 0.82 },
    label: {
      color: theme.colors.primary,
      ...theme.typography.body,
      fontWeight: '700',
    },
  });
}
