import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';

import { AuthButton, AuthField, AuthScreen } from '@/components/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/validations/login.schema';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [loginError, setLoginError] = useState('');

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
    await loginMutation.mutateAsync(data);
  };

  return (
    <AuthScreen
      eyebrow="Avisa Aí Professor"
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta para acompanhar avisos, turmas e mensagens com clareza."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Não possui uma conta?</Text>

          <Pressable onPress={() => router.push('/register')} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Criar conta</Text>
          </Pressable>
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

        {loginError ? <Text style={styles.feedbackError}>{loginError}</Text> : null}

        <AuthButton
          label="Entrar"
          loadingLabel="Entrando..."
          isLoading={loginMutation.isPending}
          onPress={handleSubmit(onSubmit)}
        />

        <Pressable onPress={() => router.push('/register')} style={styles.inlineLink}>
          <Text style={styles.inlineLinkText}>Criar conta</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    color: '#667085',
    fontSize: 13,
  },
  footerLink: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFD9D4',
    backgroundColor: '#FFFFFF',
  },
  footerLinkText: {
    color: '#205B57',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackError: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 18,
  },
  inlineLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  inlineLinkText: {
    color: '#205B57',
    fontSize: 14,
    fontWeight: '700',
  },
});
