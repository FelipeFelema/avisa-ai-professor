import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { BackButton } from './BackButton';

export type SecondaryScreenProps = {
  fallbackHref: Href;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function SecondaryScreen({ fallbackHref, children, contentStyle }: SecondaryScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backBar}>
        <BackButton fallbackHref={fallbackHref} />
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
