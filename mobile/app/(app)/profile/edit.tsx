import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';

import { AuthButton, AuthField } from '@/components/auth';
import {
  ConfirmationDialog,
  ScreenState,
  SecondaryScreen,
  type ConfirmationSummaryRow,
} from '@/components/ui';
import { getHttpErrorMessage } from '@/lib';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import type { UpdateProfileRequest } from '@/types/auth';
import {
  buildUpdateProfilePayload,
  updateProfileSchema,
  type UpdateProfileFormData,
} from '@/validations/updateProfile.schema';
import { useTheme } from '@/hooks/useTheme';
import { getAuthTheme } from '@/theme/auth';

type PendingProfileUpdate = {
  payload: UpdateProfileRequest;
  summary: ConfirmationSummaryRow[];
};

export default function ProfileEditScreen() {
  const { palette: theme } = useTheme();
  const AUTH_THEME = getAuthTheme(theme);
  const styles = createStyles(AUTH_THEME);

  const router = useRouter();
  const { user, isLoading } = useAuth();
  const updateProfile = useUpdateProfile();
  const [pendingUpdate, setPendingUpdate] = useState<PendingProfileUpdate | null>(null);
  const [confirmationError, setConfirmationError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const requestInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [navigateAfterSave, setNavigateAfterSave] = useState(false);
  const requestPending = updateProfile.isPending || isSubmitting;

  usePreventRemove(requestPending && Boolean(user) && !navigateAfterSave, () => undefined);

  useEffect(() => {
    if (!navigateAfterSave) {
      return;
    }

    router.replace('/profile');
  }, [navigateAfterSave, router]);

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
    return (
      <SecondaryScreen fallbackHref="/profile">
        <ScreenState kind="loading" title="Carregando perfil" message="Aguarde um momento." />
      </SecondaryScreen>
    );
  }

  if (!user) {
    return (
      <SecondaryScreen fallbackHref="/profile">
        <ScreenState
          kind="not-found"
          title="Perfil não disponível"
          message="Entre novamente para editar seus dados."
          actionLabel="Entrar"
          onAction={() => router.replace('/login')}
        />
      </SecondaryScreen>
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
    const sessionGeneration = getSessionGeneration();

    try {
      await updateProfile.mutateAsync(pendingUpdate.payload);
      if (!isSessionGenerationCurrent(sessionGeneration)) return;
      setPendingUpdate(null);
      setConfirmationError(undefined);
      requestInFlight.current = false;
      setIsSubmitting(false);
      setNavigateAfterSave(true);
      return;
    } catch (error) {
      if (!isSessionGenerationCurrent(sessionGeneration)) return;
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
    <SecondaryScreen fallbackHref="/profile" backPending={requestPending}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoiding}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
                editable={!requestPending}
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
                editable={!requestPending}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                error={errors.email?.message}
              />
            )}
          />

          {feedback ? (
            <Text accessibilityRole="alert" style={styles.feedback}>
              {feedback}
            </Text>
          ) : null}

          <AuthButton
            label="Salvar alterações"
            loadingLabel="Salvando..."
            isLoading={requestPending}
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
            pending={requestPending}
            errorMessage={confirmationError}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SecondaryScreen>
  );
}

function createStyles(AUTH_THEME: ReturnType<typeof getAuthTheme>) {
  return StyleSheet.create({
    keyboardAvoiding: {
      flex: 1,
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
}
