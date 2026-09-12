import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isAxiosError } from 'axios';

import { Button, ConfirmationDialog, ScreenState } from '@/components/ui';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';
import { getHttpErrorMessage } from '@/lib';
import { AUTH_THEME } from '@/theme/auth';

export default function AnnouncementDetailsScreen() {
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
      <ScreenState kind="loading" title="Carregando comunicado" message="Aguarde um momento." />
    );
  }

  if (announcementIsError) {
    const notFound = isAxiosError(announcementError) && announcementError.response?.status === 404;

    return (
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
      setDeleteConfirmationVisible(false);
      setConfirmationError(undefined);
      router.back();
    } catch (error) {
      setConfirmationError(getHttpErrorMessage(error));
    } finally {
      requestInFlight.current = false;
      setIsConfirming(false);
    }
  }

  const pending = isConfirming || deleteMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          {announcement.title}
        </Text>

        <Text style={styles.author}>Professor • {announcement.author.name}</Text>

        <View style={styles.separator} />

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

        <View style={styles.separator} />

        <Text style={styles.contentText}>{announcement.content}</Text>

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
    gap: AUTH_THEME.spacing.lg,
  },

  title: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
  },

  author: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
  },

  separator: {
    height: 1,
    backgroundColor: AUTH_THEME.colors.border,
  },

  infoContainer: {
    gap: AUTH_THEME.spacing.xs,
  },

  infoLabel: {
    color: AUTH_THEME.colors.muted,
    fontWeight: '700',
  },

  infoValue: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
  },

  contentText: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 28,
  },

  actions: {
    flexDirection: 'row',
    gap: AUTH_THEME.spacing.md,
    marginTop: AUTH_THEME.spacing.xl,
  },

  actionButton: {
    flex: 1,
  },
});
