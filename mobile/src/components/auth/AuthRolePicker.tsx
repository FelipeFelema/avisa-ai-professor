import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

export type AuthRoleValue = 'responsible' | 'teacher';

type AuthRolePickerProps = {
  value: AuthRoleValue | null;
  onChange: (value: AuthRoleValue) => void;
};

export function AuthRolePicker({ value, onChange }: AuthRolePickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.label}>
          Tipo de conta
        </Text>
        <Text style={styles.helper}>Você pode mudar isso depois se precisar.</Text>
      </View>

      <View style={styles.options}>
        <Pressable
          accessibilityLabel="Responsável"
          accessibilityHint="Acompanhar comunicados, avisos e rotinas da turma."
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'responsible' }}
          onPress={() => onChange('responsible')}
          style={({ pressed }) => [
            styles.card,
            value === 'responsible' ? styles.cardSelected : null,
            pressed ? styles.cardPressed : null,
          ]}
        >
          <Text style={styles.cardTitle}>Responsável</Text>
          <Text style={styles.cardDescription}>
            Acompanhar comunicados, avisos e rotinas da turma.
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Professor"
          accessibilityHint="Criar uma conta com código de convite da escola."
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'teacher' }}
          onPress={() => onChange('teacher')}
          style={({ pressed }) => [
            styles.card,
            value === 'teacher' ? styles.cardSelected : null,
            pressed ? styles.cardPressed : null,
          ]}
        >
          <Text style={styles.cardTitle}>Professor</Text>
          <Text style={styles.cardDescription}>
            Criar uma conta com código de convite da escola.
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  header: {
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.text,
    ...theme.typography.label,
  },
  helper: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
  options: {
    gap: theme.spacing.md,
  },
  card: {
    minHeight: theme.targets.android,
    minWidth: theme.targets.android,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  cardSelected: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.primarySubtle,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardTitle: {
    color: theme.colors.text,
    ...theme.typography.body,
    fontWeight: '700',
  },
  cardDescription: {
    color: theme.colors.textMuted,
    ...theme.typography.caption,
  },
});
