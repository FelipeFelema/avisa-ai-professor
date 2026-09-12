import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, FormField } from '@/components/ui';
import { HTTP_STATUS } from '@/constants/http-status';
import { useCreateClassroom } from '@/hooks/useCreateClassroom';
import { theme } from '@/theme';
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
          <Text accessibilityRole="header" style={styles.title}>
            Criar turma
          </Text>
          <Text style={styles.subtitle}>
            Dê um nome à sua turma para começar a compartilhar comunicados.
          </Text>
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <FormField
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

        {submitError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {submitError}
          </Text>
        ) : null}

        <Button
          label="Criar turma"
          loading={createClassroom.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  header: {
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
});
