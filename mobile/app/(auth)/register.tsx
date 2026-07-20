import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';

import {
  AuthButton,
  AuthField,
  AuthRolePicker,
  AuthScreen,
  type AuthRoleValue,
} from '@/components/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormData } from '@/validations/register.schema';

type RegisterField = 'name' | 'email' | 'password' | 'teacherCode';

function getAxiosErrorMessage(error: unknown) {
  if (!isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data as
    { message?: string | string[]; error?: string } | undefined;

  if (!responseData) {
    return null;
  }

  if (Array.isArray(responseData.message)) {
    return responseData.message[0] ?? null;
  }

  if (typeof responseData.message === 'string') {
    return responseData.message;
  }

  if (typeof responseData.error === 'string') {
    return responseData.error;
  }

  return null;
}

function getRegisterFieldFromMessage(message: string): RegisterField | null {
  const normalizedMessage = message.toLocaleLowerCase('pt-BR');

  if (normalizedMessage.includes('código de convite')) {
    return 'teacherCode';
  }

  if (normalizedMessage.includes('nome')) {
    return 'name';
  }

  if (normalizedMessage.includes('e-mail') || normalizedMessage.includes('email')) {
    return 'email';
  }

  if (normalizedMessage.includes('senha')) {
    return 'password';
  }

  return null;
}

function getFriendlyFieldMessage(field: RegisterField, message: string): string {
  const normalizedMessage = message.toLocaleLowerCase('pt-BR');

  if (field === 'name' && normalizedMessage.includes('apenas letras')) {
    return 'No nome, use apenas letras, espaços, hífen ou apóstrofo. Números não são permitidos.';
  }

  return message;
}

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] = useState<AuthRoleValue | null>(null);
  const [registerError, setRegisterError] = useState('');

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    resetField,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    shouldUnregister: true,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      teacherCode: '',
    },
  });

  const { register } = useAuth();

  const registerMutation = useMutation({
    mutationFn: register,
    onError: (error) => {
      const message = getAxiosErrorMessage(error);

      if (message) {
        const field = getRegisterFieldFromMessage(message);

        if (field) {
          setError(field, {
            type: 'manual',
            message: getFriendlyFieldMessage(field, message),
          });
          return;
        }
      }

      if (isAxiosError(error) && error.response?.status === 409) {
        setRegisterError('Esse e-mail já está cadastrado.');
        return;
      }

      if (isAxiosError(error) && !error.response) {
        setRegisterError('Verifique sua conexão com a internet.');
        return;
      }

      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        setRegisterError('Ocorreu um erro no servidor. Tente novamente mais tarde.');
        return;
      }

      setRegisterError('Não foi possível realizar o cadastro.');
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setRegisterError('');

    if (role === null) {
      setRegisterError('Selecione se a conta será de Professor ou Responsável.');
      return;
    }

    if (role === 'teacher' && !data.teacherCode?.trim()) {
      setError('teacherCode', {
        type: 'manual',
        message: 'Informe o código do professor.',
      });

      return;
    }

    const payload: RegisterFormData = {
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      teacherCode: role === 'teacher' ? data.teacherCode?.trim() || undefined : undefined,
    };

    registerMutation.mutate(payload);
  };

  const handleSelectRole = (selectedRole: AuthRoleValue) => {
    setRole(selectedRole);
    clearErrors('teacherCode');
    resetField('teacherCode', { defaultValue: '' });
    setRegisterError('');
  };

  return (
    <AuthScreen
      eyebrow="Avisa Aí Professor"
      title="Crie sua conta"
      subtitle="Escolha seu perfil e preencha os dados em um fluxo simples e seguro."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Já possui uma conta?</Text>

          <Pressable onPress={() => router.replace('/login')} style={styles.footerLink}>
            <Text style={styles.footerLinkText}>Entrar</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.content}>
        <AuthRolePicker value={role} onChange={handleSelectRole} />

        {role ? (
          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <AuthField
                  label="Nome completo"
                  placeholder="Digite seu nome"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  helperText="Use apenas letras; hífen e apóstrofo também são aceitos."
                  error={errors.name?.message}
                />
              )}
            />

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
                  placeholder="Crie uma senha"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  helperText="Use pelo menos 6 caracteres."
                  error={errors.password?.message}
                />
              )}
            />

            {role === 'teacher' && (
              <Controller
                control={control}
                name="teacherCode"
                render={({ field: { onChange, value } }) => (
                  <AuthField
                    label="Código do professor"
                    placeholder="Ex: PROF-XXXXXX"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    autoComplete="off"
                    helperText="Informe o código de convite fornecido pela escola."
                    error={errors.teacherCode?.message}
                  />
                )}
              />
            )}

            {registerError ? <Text style={styles.feedbackError}>{registerError}</Text> : null}

            <AuthButton
              label="Cadastrar"
              loadingLabel="Cadastrando..."
              isLoading={registerMutation.isPending}
              onPress={handleSubmit(onSubmit)}
            />
          </View>
        ) : null}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
  },
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
});
