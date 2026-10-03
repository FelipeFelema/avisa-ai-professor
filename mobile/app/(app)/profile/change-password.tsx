import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthButton, AuthField } from '@/components/auth';
import { ScreenState, SecondaryScreen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useChangePassword } from '@/hooks/useChangePassword';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from '@/validations/changePassword.schema';

const emptyForm: ChangePasswordFormData = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};
const fields = [
  {
    name: 'currentPassword',
    label: 'Senha atual',
    purpose: 'password',
    autocomplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: 'Nova senha',
    purpose: 'newPassword',
    autocomplete: 'new-password',
  },
  {
    name: 'confirmNewPassword',
    label: 'Confirmar nova senha',
    purpose: 'newPassword',
    autocomplete: 'new-password',
  },
] as const;

export default function ProfileChangePasswordScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { submit, isPending, feedback, clearFeedback } = useChangePassword();
  const [success, setSuccess] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: emptyForm,
  });

  usePreventRemove(isPending && Boolean(user), () => undefined);
  useFocusEffect(
    useCallback(() => {
      reset(emptyForm);
      setSuccess(false);
      clearFeedback();
      return () => {
        reset(emptyForm);
        clearFeedback();
      };
    }, [reset, clearFeedback]),
  );
  useEffect(() => {
    if (!user) {
      reset(emptyForm);
      clearFeedback();
    }
  }, [user, reset, clearFeedback]);
  useEffect(() => {
    if (feedback?.field) {
      setError(feedback.field, { type: 'server', message: feedback.message });
      setFocus(feedback.field);
    }
  }, [feedback, setError, setFocus]);

  const onSubmit = async (values: ChangePasswordFormData) => {
    setSuccess(false);
    const result = await submit(values);
    if (result === 'success') {
      reset(emptyForm);
      setSuccess(true);
    }
  };

  if (isLoading || !user)
    return (
      <SecondaryScreen fallbackHref="/profile">
        <ScreenState
          kind={isLoading ? 'loading' : 'not-found'}
          title={isLoading ? 'Carregando perfil' : 'Perfil não disponível'}
          message="Entre novamente para alterar sua senha."
          actionLabel={isLoading ? undefined : 'Entrar'}
          onAction={() => router.replace('/login')}
        />
      </SecondaryScreen>
    );

  return (
    <SecondaryScreen fallbackHref="/profile" backPending={isPending}>
      <KeyboardAvoidingView
        testID="password-keyboard-avoidance"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          testID="password-scroll"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={styles.title}>
            Alterar senha
          </Text>
          <Text style={styles.subtitle}>
            Informe a senha atual e confirme a nova senha. Você continuará conectado neste
            dispositivo.
          </Text>
          {fields.map(({ name, label, purpose, autocomplete }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <AuthField
                  label={label}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  inputRef={ref}
                  editable={!isPending}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={autocomplete}
                  textContentType={purpose}
                  error={errors[name]?.message}
                />
              )}
            />
          ))}
          {success ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.feedback}
            >
              Senha alterada com sucesso.
            </Text>
          ) : null}
          {feedback && !feedback.field ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.feedback}
            >
              {feedback.message}
            </Text>
          ) : null}
          <AuthButton
            label="Alterar senha"
            loadingLabel="Alterando..."
            isLoading={isPending}
            onPress={handleSubmit(onSubmit)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SecondaryScreen>
  );
}

function createStyles(palette: Theme) {
  return StyleSheet.create({
    keyboard: { flex: 1 },
    content: { padding: palette.spacing.xl, gap: palette.spacing.xl },
    title: { ...palette.typography.title, color: palette.colors.text, fontWeight: '800' },
    subtitle: { ...palette.typography.body, color: palette.colors.textMuted },
    feedback: { ...palette.typography.body, color: palette.colors.text },
  });
}
