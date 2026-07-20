import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton, AuthField } from '@/components/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { useCreateClassroom } from '@/hooks/useCreateClassroom';
import { AUTH_THEME } from '@/theme/auth';
import {
  createClassroomSchema,
  type CreateClassroomFormData,
} from '@/validations/createClassroom.schema';

function getApiErrorMessage(error: unknown): string | null {
  if (!isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data as { message?: string | string[] } | undefined;

  if (Array.isArray(responseData?.message)) {
    return responseData.message[0] ?? null;
  }

  return typeof responseData?.message === 'string' ? responseData.message : null;
}

export default function NewClassroomScreen() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const createClassroom = useCreateClassroom();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateClassroomFormData>({
    resolver: zodResolver(createClassroomSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: CreateClassroomFormData) => {
    setSubmitError('');

    try {
      await createClassroom.mutateAsync({ name: data.name });
      router.replace('/classrooms');
    } catch (error) {
      const message = getApiErrorMessage(error);

      if (message) {
        setError('name', { type: 'manual', message });
        return;
      }

      if (isAxiosError(error) && !error.response) {
        setSubmitError('Verifique sua conexão com a internet e tente novamente.');
        return;
      }

      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        setSubmitError('Ocorreu um erro no servidor. Tente novamente mais tarde.');
        return;
      }

      setSubmitError('Não foi possível criar a turma. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Criar turma</Text>
          <Text style={styles.subtitle}>
            Dê um nome à sua turma para começar a compartilhar comunicados.
          </Text>
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <AuthField
              label="Nome da turma"
              placeholder="Ex.: 1º Ano A"
              value={value}
              onChangeText={onChange}
              autoCapitalize="words"
              autoComplete="off"
              helperText="O nome será exibido em letras maiúsculas."
              error={errors.name?.message}
            />
          )}
        />

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <AuthButton
          label="Criar turma"
          loadingLabel="Criando turma..."
          isLoading={createClassroom.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },
  content: {
    flex: 1,
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.xl,
  },
  header: {
    gap: AUTH_THEME.spacing.sm,
  },
  title: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },
  error: {
    color: AUTH_THEME.colors.error,
    fontSize: AUTH_THEME.typography.caption,
    lineHeight: 18,
  },
});
