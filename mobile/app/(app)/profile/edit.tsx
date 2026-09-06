import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';

import { AuthButton, AuthField } from '@/components/auth';
import { ConfirmationDialog, ScreenState, type ConfirmationSummaryRow } from '@/components/ui';
import { getHttpErrorMessage } from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import type { UpdateProfileRequest } from '@/types/auth';
import {
  buildUpdateProfilePayload,
  updateProfileSchema,
  type UpdateProfileFormData,
} from '@/validations/updateProfile.schema';
import { AUTH_THEME } from '@/theme/auth';

type PendingProfileUpdate = {
  payload: UpdateProfileRequest;
  summary: ConfirmationSummaryRow[];
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const updateProfile = useUpdateProfile();
  const [pendingUpdate, setPendingUpdate] = useState<PendingProfileUpdate | null>(null);
  const [confirmationError, setConfirmationError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const requestInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
  });

  if (isLoading) {
    return <ScreenState kind="loading" title="Carregando perfil" message="Aguarde um momento." />;
  }

  if (!user) {
    return (
      <ScreenState
        kind="not-found"
        title="Perfil não disponível"
        message="Entre novamente para editar seus dados."
        actionLabel="Entrar"
        onAction={() => router.replace('/login')}
      />
    );
  }

  const onSubmit = (values: UpdateProfileFormData) => {
    const payload = buildUpdateProfilePayload(user, values);

    if (Object.keys(payload).length === 0) {
      setFeedback('Nenhuma alteração para salvar.');
      setPendingUpdate(null);
      return;
    }

    const summary: ConfirmationSummaryRow[] = [];
    if (payload.name !== undefined) {
      summary.push({ label: 'Nome', value: `${user.name} → ${payload.name}` });
    }
    if (payload.email !== undefined) {
      summary.push({ label: 'E-mail', value: `${user.email} → ${payload.email}` });
    }

    setFeedback(undefined);
    setConfirmationError(undefined);
    setPendingUpdate({ payload, summary });
  };

  const cancelConfirmation = () => {
    if (requestInFlight.current) {
      return;
    }

    setPendingUpdate(null);
    setConfirmationError(undefined);
  };

  const confirmUpdate = async () => {
    if (!pendingUpdate || requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setIsSubmitting(true);

    try {
      await updateProfile.mutateAsync(pendingUpdate.payload);
      setPendingUpdate(null);
      setConfirmationError(undefined);
      router.replace('/profile');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setError('email', {
          type: 'server',
          message: 'Este e-mail já está em uso.',
        });
      }

      setConfirmationError(getHttpErrorMessage(error));
    } finally {
      requestInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Editar perfil
        </Text>
        <Text style={styles.subtitle}>
          Atualize somente seu nome e e-mail. O perfil de acesso permanece inalterado.
        </Text>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <AuthField
              label="Nome"
              placeholder="Seu nome completo"
              value={value}
              onChangeText={onChange}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
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

        <AuthField label="Perfil" value={user.role} editable={false} />

        {feedback ? (
          <Text accessibilityRole="alert" style={styles.feedback}>
            {feedback}
          </Text>
        ) : null}

        <AuthButton
          label="Salvar alterações"
          loadingLabel="Salvando..."
          isLoading={updateProfile.isPending || isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />

        <ConfirmationDialog
          visible={pendingUpdate !== null}
          title="Confirmar alterações"
          targetLabel="Seu perfil"
          summary={pendingUpdate?.summary}
          confirmLabel="Salvar alterações"
          onCancel={cancelConfirmation}
          onConfirm={confirmUpdate}
          pending={updateProfile.isPending || isSubmitting}
          errorMessage={confirmationError}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },
  content: {
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.xl,
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
  feedback: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
  },
});
