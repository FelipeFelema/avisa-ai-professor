import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isAxiosError } from 'axios';

import { AnnouncementCard } from '@/components/announcements';
import { Button, ConfirmationDialog, ScreenState, SecondaryScreen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { getHttpErrorMessage } from '@/lib';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

type ClassroomAction = 'delete' | 'leave';

export default function ClassroomDetailsScreen() {
  const { palette: theme } = useTheme();
  const styles = createStyles(theme);

  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const classroomId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useAuth();
  const [action, setAction] = useState<ClassroomAction | null>(null);
  const [actionError, setActionError] = useState<string>();
  const actionInFlight = useRef(false);

  const {
    data: classrooms,
    isLoading: classroomsLoading,
    isError: classroomsError,
    refetch: refetchClassrooms,
  } = useMyClassrooms();
  const {
    data: announcements,
    isLoading: announcementsLoading,
    isError: announcementsError,
    error: announcementsErrorValue,
    refetch: refetchAnnouncements,
  } = useClassroomAnnouncements(classroomId ?? '');
  const deleteMutation = useDeleteClassroom();
  const leaveMutation = useLeaveClassroom();
  const classroom = classrooms?.find((item) => item.id === classroomId);
  const pending = deleteMutation.isPending || leaveMutation.isPending;

  function openAction(kind: ClassroomAction) {
    setActionError(undefined);
    setAction(kind);
  }

  function closeAction() {
    if (pending || actionInFlight.current) {
      return;
    }

    setAction(null);
    setActionError(undefined);
  }

  function confirmAction() {
    if (!classroom || !action || pending || actionInFlight.current) {
      return;
    }

    actionInFlight.current = true;
    const mutation = action === 'delete' ? deleteMutation : leaveMutation;
    mutation.mutate(classroom.id, {
      onSuccess: () => {
        actionInFlight.current = false;
        setAction(null);
        setActionError(undefined);
        router.replace('/classrooms');
      },
      onError: (error) => {
        actionInFlight.current = false;
        setActionError(getHttpErrorMessage(error));
      },
    });
  }

  if (classroomsLoading) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState kind="loading" title="Carregando turma" message="Aguarde um momento." />
      </SecondaryScreen>
    );
  }

  if (classroomsError) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState
          kind="error"
          title="Não foi possível carregar a turma"
          message="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={() => {
            void refetchClassrooms();
          }}
        />
      </SecondaryScreen>
    );
  }

  if (!classroom) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState
          kind="not-found"
          title="Turma não encontrada"
          message="Esta turma não está mais disponível."
          actionLabel="Ver turmas"
          onAction={() => router.replace('/classrooms')}
        />
      </SecondaryScreen>
    );
  }

  const announcementsNotFound =
    announcementsError &&
    isAxiosError(announcementsErrorValue) &&
    announcementsErrorValue.response?.status === 404;

  if (announcementsNotFound) {
    return (
      <SecondaryScreen fallbackHref="/classrooms">
        <ScreenState
          kind="not-found"
          title="Turma não encontrada"
          message="Esta turma não está mais disponível."
          actionLabel="Ver turmas"
          onAction={() => {
            router.replace('/classrooms');
          }}
        />
      </SecondaryScreen>
    );
  }

  const isOwner = user?.id === classroom.ownerId;
  const canShowClassroomAction = Boolean(user?.id);

  return (
    <>
      <SecondaryScreen fallbackHref="/classrooms">
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.classroomName}>
                {classroom.name}
              </Text>
              <Text accessibilityRole="header" style={styles.title}>
                Comunicados
              </Text>
            </View>

            {user?.role === 'PROFESSOR' ? (
              <Button
                label="+ Novo"
                accessibilityLabel="Criar comunicado"
                style={styles.createButton}
                onPress={() => router.push(`/classrooms/${classroom.id}/new-announcement`)}
              />
            ) : null}
          </View>

          {announcementsLoading ? (
            <ScreenState
              kind="loading"
              title="Carregando comunicados"
              message="Aguarde um momento."
            />
          ) : announcementsError ? (
            <ScreenState
              kind="error"
              title="Não foi possível carregar os comunicados"
              message={getHttpErrorMessage(announcementsErrorValue)}
              actionLabel="Tentar novamente"
              onAction={() => {
                void refetchAnnouncements();
              }}
            />
          ) : announcements?.length === 0 ? (
            <ScreenState
              kind="empty"
              title="Nenhum comunicado"
              message="Ainda não existem comunicados para esta turma."
            />
          ) : (
            announcements?.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                title={announcement.title}
                content={announcement.content}
                author={announcement.author.name}
                expiresAt={announcement.expiresAt}
                onPress={() => router.push(`/announcements/${announcement.id}`)}
              />
            ))
          )}

          {canShowClassroomAction ? (
            <Button
              label={isOwner ? 'Excluir turma' : 'Sair da turma'}
              accessibilityLabel={isOwner ? 'Excluir turma' : 'Sair da turma'}
              variant="destructive"
              style={styles.actionButton}
              onPress={() => openAction(isOwner ? 'delete' : 'leave')}
            />
          ) : null}
        </ScrollView>
      </SecondaryScreen>

      {action ? (
        <ConfirmationDialog
          visible
          title={action === 'delete' ? 'Excluir turma' : 'Sair da turma'}
          targetLabel={classroom.name}
          consequence={
            action === 'delete'
              ? 'Participantes e comunicados serão removidos permanentemente.'
              : 'Seu acesso e sua participação serão removidos.'
          }
          variant="destructive"
          confirmLabel={action === 'delete' ? 'Excluir turma' : 'Sair da turma'}
          onCancel={closeAction}
          onConfirm={confirmAction}
          pending={pending}
          errorMessage={actionError}
        />
      ) : null}
    </>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xxxl,
      gap: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    headerText: { flex: 1, gap: theme.spacing.xs },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.text,
    },
    classroomName: {
      ...theme.typography.title,
      color: theme.colors.text,
    },
    createButton: {
      paddingHorizontal: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    actionButton: {
      alignSelf: 'stretch',
    },
  });
}
