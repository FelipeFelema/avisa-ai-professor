import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  createAnnouncementSchema,
  type CreateAnnouncementFormData,
} from '@/validations/createAnnouncementSchema';
import { ANNOUNCEMENT_DURATIONS } from '@/types/announcement';

import { ConfirmationDialog, type ConfirmationSummaryRow, ScreenState } from '@/components/ui';
import { getHttpErrorMessage } from '@/lib';
import { AUTH_THEME } from '@/theme/auth';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import {
  useUpdateAnnouncement,
  type UpdateAnnouncementMutation,
} from '@/hooks/useUpdateAnnouncement';

type AnnouncementUpdateData = UpdateAnnouncementMutation['data'];

type PendingAnnouncementUpdate = {
  data: AnnouncementUpdateData;
  summary: ConfirmationSummaryRow[];
};

function getClosestAnnouncementDuration(createdAt: string, expiresAt: string) {
  const createdDate = new Date(createdAt).getTime();
  const expiresDate = new Date(expiresAt).getTime();

  const durationInDays = Math.max(
    1,
    Math.round((expiresDate - createdDate) / (1000 * 60 * 60 * 24)),
  );

  return ANNOUNCEMENT_DURATIONS.reduce((closest, current) => {
    const closestDistance = Math.abs(closest - durationInDays);
    const currentDistance = Math.abs(current - durationInDays);

    return currentDistance < closestDistance ? current : closest;
  }, ANNOUNCEMENT_DURATIONS[0]);
}

function buildAnnouncementSummary(
  current: {
    title: string;
    content: string;
    durationInDays: number;
  },
  next: AnnouncementUpdateData,
): ConfirmationSummaryRow[] {
  const summary: ConfirmationSummaryRow[] = [];

  if (current.title !== next.title) {
    summary.push({ label: 'Título', value: `${current.title} → ${next.title}` });
  }

  if (current.content !== next.content) {
    summary.push({ label: 'Conteúdo', value: `${current.content} → ${next.content}` });
  }

  if (current.durationInDays !== next.durationInDays) {
    summary.push({
      label: 'Duração',
      value: `${current.durationInDays} dias → ${next.durationInDays} dias`,
    });
  }

  return summary;
}

export default function EditAnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: announcement,
    error: announcementError,
    isError: announcementIsError,
    isLoading,
    refetch: refetchAnnouncement,
  } = useAnnouncement(id);
  const updateAnnouncement = useUpdateAnnouncement();
  const [pendingUpdate, setPendingUpdate] = useState<PendingAnnouncementUpdate | null>(null);
  const [confirmationError, setConfirmationError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);
  const requestInFlight = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAnnouncementFormData>({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: {
      title: '',
      content: '',
      durationInDays: 7,
    },
  });

  useEffect(() => {
    if (!announcement) {
      return;
    }

    reset({
      title: announcement.title,
      content: announcement.content,
      durationInDays: getClosestAnnouncementDuration(
        announcement.createdAt,
        announcement.expiresAt,
      ),
    });
  }, [announcement, reset]);

  if (isLoading) {
    return (
      <ScreenState kind="loading" title="Carregando comunicado" message="Aguarde um momento." />
    );
  }

  if (announcementIsError) {
    return (
      <ScreenState
        kind="error"
        title="Não foi possível carregar o comunicado"
        message={getHttpErrorMessage(announcementError)}
        actionLabel="Tentar novamente"
        onAction={() => {
          void refetchAnnouncement();
        }}
      />
    );
  }

  if (!announcement) {
    return (
      <ScreenState
        kind="not-found"
        title="Comunicado não encontrado"
        message="Este comunicado não está mais disponível."
        actionLabel="Voltar"
        onAction={() => router.back()}
      />
    );
  }

  const currentDurationInDays = getClosestAnnouncementDuration(
    announcement.createdAt,
    announcement.expiresAt,
  );

  const onSubmit = (data: CreateAnnouncementFormData) => {
    const summary = buildAnnouncementSummary(
      {
        title: announcement.title,
        content: announcement.content,
        durationInDays: currentDurationInDays,
      },
      data,
    );

    if (summary.length === 0) {
      setFeedback('Nenhuma alteração para salvar.');
      return;
    }

    setFeedback(undefined);
    setConfirmationError(undefined);
    setPendingUpdate({ data, summary });
  };

  const cancelConfirmation = () => {
    if (isConfirming || requestInFlight.current) {
      return;
    }

    setPendingUpdate(null);
    setConfirmationError(undefined);
  };

  const confirmUpdate = async () => {
    if (!pendingUpdate || isConfirming || updateAnnouncement.isPending || requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setIsConfirming(true);

    try {
      await updateAnnouncement.mutateAsync({
        announcementId: announcement.id,
        classroomId: announcement.classroomId,
        data: pendingUpdate.data,
      });
      setPendingUpdate(null);
      setConfirmationError(undefined);
      router.back();
    } catch (error) {
      setConfirmationError(getHttpErrorMessage(error));
    } finally {
      requestInFlight.current = false;
      setIsConfirming(false);
    }
  };

  const pending = isConfirming || updateAnnouncement.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Editar comunicado</Text>
        <Text style={styles.subtitle}>Atualize as informações do comunicado.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Título</Text>

          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange } }) => (
              <TextInput
                accessibilityLabel="Título"
                value={value}
                onChangeText={onChange}
                placeholder="Digite o título"
                placeholderTextColor={AUTH_THEME.colors.muted}
                style={styles.input}
              />
            )}
          />

          {errors.title && <Text style={styles.error}>{errors.title.message}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Conteúdo</Text>

          <Controller
            control={control}
            name="content"
            render={({ field: { value, onChange } }) => (
              <TextInput
                accessibilityLabel="Conteúdo"
                multiline
                textAlignVertical="top"
                scrollEnabled
                maxLength={2000}
                value={value}
                onChangeText={onChange}
                placeholder="Digite o comunicado..."
                placeholderTextColor={AUTH_THEME.colors.muted}
                style={styles.textArea}
              />
            )}
          />

          {errors.content && <Text style={styles.error}>{errors.content.message}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Duração</Text>

          <Controller
            control={control}
            name="durationInDays"
            render={({ field: { value, onChange } }) => (
              <View style={styles.durationContainer}>
                {ANNOUNCEMENT_DURATIONS.map((days) => (
                  <Pressable
                    key={days}
                    accessibilityRole="button"
                    accessibilityLabel={`${days} ${days === 1 ? 'dia' : 'dias'}`}
                    accessibilityState={{ selected: value === days }}
                    onPress={() => onChange(days)}
                    style={[styles.durationChip, value === days && styles.selectedDurationChip]}
                  >
                    <Text
                      style={[styles.durationText, value === days && styles.selectedDurationText]}
                    >
                      {days} {days === 1 ? 'dia' : 'dias'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pendingUpdate !== null || pending, busy: pending }}
          style={styles.submitButton}
          onPress={handleSubmit(onSubmit)}
          disabled={pendingUpdate !== null || pending}
        >
          <Text style={styles.submitText}>
            {pending ? 'Atualizando...' : 'Atualizar comunicado'}
          </Text>
        </Pressable>

        {feedback ? (
          <Text accessibilityRole="alert" style={styles.feedback}>
            {feedback}
          </Text>
        ) : null}
      </ScrollView>

      {pendingUpdate ? (
        <ConfirmationDialog
          visible
          title="Confirmar atualização"
          targetLabel={announcement.title}
          summary={pendingUpdate.summary}
          variant="neutral"
          confirmLabel="Atualizar comunicado"
          onCancel={cancelConfirmation}
          onConfirm={() => {
            void confirmUpdate();
          }}
          pending={pending}
          errorMessage={confirmationError}
        />
      ) : null}
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
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    color: AUTH_THEME.colors.text,
    textAlign: 'center',
  },

  subtitle: {
    textAlign: 'center',
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },

  field: {
    gap: AUTH_THEME.spacing.sm,
  },

  label: {
    color: AUTH_THEME.colors.text,
    fontWeight: '700',
    fontSize: AUTH_THEME.typography.body,
  },

  input: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.md,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.md,
    color: AUTH_THEME.colors.text,
  },

  textArea: {
    minHeight: 180,
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.md,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.md,
    color: AUTH_THEME.colors.text,
  },

  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AUTH_THEME.spacing.sm,
  },

  durationChip: {
    paddingHorizontal: AUTH_THEME.spacing.lg,
    paddingVertical: AUTH_THEME.spacing.sm,
    borderRadius: AUTH_THEME.radius.pill,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    backgroundColor: AUTH_THEME.colors.surface,
  },

  durationText: {
    color: AUTH_THEME.colors.text,
    fontWeight: '600',
  },

  submitButton: {
    backgroundColor: AUTH_THEME.colors.primary,
    borderRadius: AUTH_THEME.radius.md,
    paddingVertical: AUTH_THEME.spacing.md,
    alignItems: 'center',
    marginTop: AUTH_THEME.spacing.xl,
  },

  submitText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: AUTH_THEME.typography.body,
  },

  selectedDurationChip: {
    backgroundColor: AUTH_THEME.colors.primary,
    borderColor: AUTH_THEME.colors.primary,
  },

  selectedDurationText: {
    color: '#FFF',
  },

  error: {
    color: '#DC2626',
    fontSize: AUTH_THEME.typography.caption,
    marginTop: AUTH_THEME.spacing.xs,
  },

  feedback: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
  },
});
