import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isAxiosError } from 'axios';

import { Button, ConfirmationDialog, ScreenState, SecondaryScreen } from '@/components/ui';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';
import { getHttpErrorMessage } from '@/lib';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

export default function AnnouncementDetailsScreen() {
  const { palette: theme } = useTheme();
  const styles = createStyles(theme);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { user } = useAuth();

  const {
    data: announcement,
    error: announcementError,
    isError: announcementIsError,
    isLoading,
    refetch: refetchAnnouncement,
  } = useAnnouncement(id);

  const deleteMutation = useDeleteAnnouncement();
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);
  const requestInFlight = useRef(false);

  const isAuthor = user?.id === announcement?.author.id;

  if (isLoading) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState kind="loading" title="Carregando comunicado" message="Aguarde um momento." />
      </SecondaryScreen>
    );
  }

  if (announcementIsError) {
    const notFound = isAxiosError(announcementError) && announcementError.response?.status === 404;

    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState
          kind={notFound ? 'not-found' : 'error'}
          title={notFound ? 'Comunicado não encontrado' : 'Não foi possível carregar o comunicado'}
          message={
            notFound
              ? 'Este comunicado não está mais disponível.'
              : getHttpErrorMessage(announcementError)
          }
          actionLabel={notFound ? 'Voltar' : 'Tentar novamente'}
          onAction={() => {
            if (notFound) {
              router.back();
            } else {
              void refetchAnnouncement();
            }
          }}
        />
      </SecondaryScreen>
    );
  }

  if (!announcement) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState
          kind="not-found"
          title="Comunicado não encontrado"
          message="Este comunicado não está mais disponível."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </SecondaryScreen>
    );
  }

  const announcementId = announcement.id;

  function openDeleteConfirmation() {
    setConfirmationError(undefined);
    setDeleteConfirmationVisible(true);
  }

  function cancelDeleteConfirmation() {
    if (isConfirming || requestInFlight.current) {
      return;
    }

    setDeleteConfirmationVisible(false);
    setConfirmationError(undefined);
  }

  async function confirmDelete() {
    if (
      !deleteConfirmationVisible ||
      isConfirming ||
      deleteMutation.isPending ||
      requestInFlight.current
    ) {
      return;
    }

    requestInFlight.current = true;
    setIsConfirming(true);
    const sessionGeneration = getSessionGeneration();

    if (!announcement) {
      requestInFlight.current = false;
      setIsConfirming(false);
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        announcementId,
        classroomId: announcement.classroomId,
      });
      if (!isSessionGenerationCurrent(sessionGeneration)) return;
      setDeleteConfirmationVisible(false);
      setConfirmationError(undefined);
      router.back();
    } catch (error) {
      if (!isSessionGenerationCurrent(sessionGeneration)) return;
      setConfirmationError(getHttpErrorMessage(error));
    } finally {
      requestInFlight.current = false;
      setIsConfirming(false);
    }
  }

  const pending = isConfirming || deleteMutation.isPending;

  return (
    <SecondaryScreen fallbackHref={`/classrooms/${announcement.classroomId}`}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <Text accessibilityRole="header" style={styles.title}>
            {announcement.title}
          </Text>

          <Text style={styles.author}>Professor • {announcement.author.name}</Text>
        </View>

        <View style={styles.metadataGroup}>
          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Publicado em</Text>

            <Text style={styles.infoValue}>
              {new Date(announcement.createdAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Expira em</Text>

            <Text style={styles.infoValue}>
              {new Date(announcement.expiresAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>

        <View style={styles.bodyGroup}>
          <Text style={styles.contentText}>{announcement.content}</Text>
        </View>

        {isAuthor && (
          <View style={styles.actions}>
            <Button
              label="Editar"
              accessibilityLabel="Editar comunicado"
              style={styles.actionButton}
              onPress={() => router.push(`/announcements/${announcement.id}/edit`)}
            />

            <Button
              label="Excluir"
              variant="destructive"
              accessibilityLabel="Excluir comunicado"
              style={styles.actionButton}
              onPress={openDeleteConfirmation}
            />
          </View>
        )}
      </ScrollView>

      {deleteConfirmationVisible ? (
        <ConfirmationDialog
          visible
          title="Excluir comunicado"
          targetLabel={announcement.title}
          consequence="Esta ação é irreversível."
          variant="destructive"
          confirmLabel="Excluir comunicado"
          onCancel={cancelDeleteConfirmation}
          onConfirm={() => {
            void confirmDelete();
          }}
          pending={pending}
          errorMessage={confirmationError}
        />
      ) : null}
    </SecondaryScreen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
    },

    headerGroup: {
      gap: theme.spacing.xs,
    },

    bodyGroup: {
      paddingTop: theme.spacing.xs,
    },

    title: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontWeight: '800',
    },

    author: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },

    metadataGroup: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },

    infoContainer: {
      gap: theme.spacing.xs,
    },

    infoLabel: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
      fontWeight: '700',
    },

    infoValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      flexShrink: 1,
    },

    contentText: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 28,
    },

    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
      marginTop: theme.spacing.xl,
    },

    actionButton: {
      flexGrow: 1,
      flexBasis: 140,
    },
  });
}
