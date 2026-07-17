import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTH_THEME } from '@/theme/auth';

export type AuthRoleValue = 'responsible' | 'teacher';

type AuthRolePickerProps = {
  value: AuthRoleValue | null;
  onChange: (value: AuthRoleValue) => void;
};

export function AuthRolePicker({ value, onChange }: AuthRolePickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Tipo de conta</Text>
        <Text style={styles.helper}>Você pode mudar isso depois se precisar.</Text>
      </View>

      <View style={styles.options}>
        <Pressable
          accessibilityRole="button"
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
          accessibilityRole="button"
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
    gap: AUTH_THEME.spacing.md,
  },
  header: {
    gap: AUTH_THEME.spacing.xs,
  },
  label: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.label,
    fontWeight: '700',
  },
  helper: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 18,
  },
  options: {
    gap: AUTH_THEME.spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    borderRadius: AUTH_THEME.radius.lg,
    backgroundColor: AUTH_THEME.colors.surfaceSoft,
    padding: AUTH_THEME.spacing.lg,
    gap: AUTH_THEME.spacing.xs,
  },
  cardSelected: {
    borderColor: AUTH_THEME.colors.primaryBorder,
    backgroundColor: AUTH_THEME.colors.primarySoft,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardTitle: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '700',
  },
  cardDescription: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 18,
  },
});
