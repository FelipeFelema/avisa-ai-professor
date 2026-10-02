import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemePreference } from '@/contexts/ThemeContext';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

const choices: {
  preference: ThemePreference;
  label: string;
  icon: 'sunny-outline' | 'moon-outline';
}[] = [
  { preference: 'light', label: 'Claro', icon: 'sunny-outline' },
  { preference: 'dark', label: 'Escuro', icon: 'moon-outline' },
];

export function ThemeSelector() {
  const { palette, preference, setTheme, persistenceWarning } = useTheme();
  const styles = createStyles(palette);

  return (
    <View testID="theme-selector" style={styles.container}>
      <Text style={styles.currentTheme}>
        Tema atual: {preference === 'light' ? 'Claro' : 'Escuro'}
      </Text>

      <View accessibilityRole="radiogroup" accessibilityLabel="Tema" style={styles.options}>
        {choices.map((choice) => {
          const selected = preference === choice.preference;

          return (
            <Pressable
              key={choice.preference}
              testID={`theme-option-${choice.preference}`}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected }}
              onPress={() => setTheme(choice.preference)}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : null,
                pressed ? styles.optionPressed : null,
              ]}
            >
              <Ionicons
                testID={`theme-option-icon-${choice.preference}`}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
                name={choice.icon}
                size={18}
                color={selected ? palette.colors.primary : palette.colors.textMuted}
              />
              <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                {choice.label}
              </Text>
              {selected ? (
                <Ionicons
                  testID="theme-selected-indicator"
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  name="checkmark-circle"
                  size={18}
                  color={palette.colors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {persistenceWarning ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>
          {persistenceWarning}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    currentTheme: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    options: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    option: {
      flex: 1,
      minHeight: Math.max(theme.targets.ios, theme.targets.android),
      minWidth: Math.max(theme.targets.ios, theme.targets.android),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surfaceMuted,
    },
    optionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySubtle,
    },
    optionPressed: {
      transform: [{ scale: 0.98 }],
    },
    optionText: {
      color: theme.colors.text,
      ...theme.typography.label,
    },
    optionTextSelected: {
      fontWeight: '700',
    },
    warning: {
      color: theme.colors.danger,
      backgroundColor: theme.colors.dangerSubtle,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      ...theme.typography.body,
    },
  });
}
