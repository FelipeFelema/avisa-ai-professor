import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';

import { AuthButton, AuthField, AuthScreen } from '@/components/auth';
import { Button, ThemeSelector } from '@/components/ui';
import { HTTP_STATUS } from '@/constants/http-status';
import { useAuth } from '@/hooks/useAuth';
import { consumeSessionNotice } from '@/lib/session-notice';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { loginSchema, type LoginFormData } from '@/validations/login.schema';

export default function LoginScreen() {
  const { palette: theme } = useTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const { login, sessionStorageRecoveryRequired, retrySessionCleanup } = useAuth();
  const [loginError, setLoginError] = useState('');
  const [sessionNotice, setSessionNotice] = useState(() => consumeSessionNotice());

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
        setLoginError('E-mail ou senha inválidos.');
        return;
      }

      if (isAxiosError(error) && !error.response) {
        setLoginError('Verifique sua conexão com a internet.');
        return;
      }

      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        setLoginError('Ocorreu um erro no servidor. Tente novamente mais tarde.');
        return;
      }

      setLoginError('Não foi possível realizar o login.');
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoginError('');
    setSessionNotice(undefined);
    await loginMutation.mutateAsync(data).catch(() => undefined);
  };

  return (
    <AuthScreen
      eyebrow="Avisa Aí Professor"
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta para acompanhar avisos, turmas e mensagens com clareza."
      headerAccessory={<ThemeSelector />}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Não possui uma conta?</Text>

          <Button
            label="Criar conta"
            variant="ghost"
            onPress={() => router.push('/register')}
            style={styles.footerLink}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <AuthField
              label="E-mail"
              placeholder="seuemail@exemplo.com"
              value={value}
              onChangeText={onChange}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AuthField
              label="Senha"
              placeholder="Sua senha"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              error={errors.password?.message}
            />
          )}
        />

        {loginError ? (
          <Text accessibilityRole="alert" style={styles.feedbackError}>
            {loginError}
          </Text>
        ) : null}

        {sessionNotice ? (
          <Text accessibilityRole="alert" style={styles.sessionNotice}>
            {sessionNotice === 'account-deleted'
              ? 'Sua conta foi excluída e as sessões foram encerradas.'
              : 'Sua sessão terminou. Entre novamente.'}
          </Text>
        ) : null}

        {sessionStorageRecoveryRequired ? (
          <View style={styles.sessionRecovery}>
            <Text accessibilityRole="alert" style={styles.sessionNotice}>
              O acesso privado foi encerrado. Não foi possível remover todas as credenciais locais.
            </Text>
            <Button
              label="Tentar limpar a sessão local"
              variant="secondary"
              onPress={() => void retrySessionCleanup?.()}
            />
          </View>
        ) : null}

        <AuthButton
          label="Entrar"
          loadingLabel="Entrando..."
          isLoading={loginMutation.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </AuthScreen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    form: {
      gap: theme.spacing.lg,
    },
    footer: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    footerText: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    footerLink: {
      minWidth: theme.targets.android,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    feedbackError: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
    sessionNotice: {
      color: theme.colors.text,
      ...theme.typography.body,
    },
    sessionRecovery: {
      gap: theme.spacing.sm,
    },
  });
}
