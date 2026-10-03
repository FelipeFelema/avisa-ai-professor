import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

import { BackButton } from './BackButton';

export type SecondaryScreenProps = {
  fallbackHref: Href;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  backDisabled?: boolean;
  backPending?: boolean;
};

export function SecondaryScreen({
  fallbackHref,
  children,
  contentStyle,
  backDisabled = false,
  backPending = false,
}: SecondaryScreenProps) {
  const { palette: theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backBar}>
        <BackButton
          fallbackHref={fallbackHref}
          disabled={backDisabled || backPending}
          pending={backPending}
        />
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backBar: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
    },
    content: {
      flex: 1,
    },
  });
}
