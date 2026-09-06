import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ClassroomCard, EmptyClassroomState } from '@/components/home';
import { Button, ConfirmationDialog, FormField, ScreenState } from '@/components/ui';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useAuth } from '@/hooks/useAuth';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { getHttpErrorMessage, isUnauthorizedError } from '@/lib';
import { theme } from '@/theme';
import type { ClassroomSummary } from '@/types/classroom';

type ClassroomAction = {
  kind: 'delete' | 'leave';
  classroom: ClassroomSummary;
};

export default function ClassroomsScreen() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<ClassroomAction | null>(null);
  const [actionError, setActionError] = useState<string>();
  const actionInFlight = useRef(false);
  const {
    data: availableClassrooms = [],
    isLoading: availableLoading,
    isError: availableError,
    refetch: refetchAvailableClassrooms,
  } = useAvailableClassrooms(search);
  const {
    data: classrooms,
    isLoading: classroomsLoading,
    isError: classroomsError,
    refetch: refetchClassrooms,
  } = useMyClassrooms();
  const router = useRouter();
  const joinMutation = useJoinClassroom();
  const leaveMutation = useLeaveClassroom();
  const deleteMutation = useDeleteClassroom();
  const { user } = useAuth();

  const pending = deleteMutation.isPending || leaveMutation.isPending;

  function openAction(kind: ClassroomAction['kind'], classroom: ClassroomSummary) {
    setActionError(undefined);
    setAction({ kind, classroom });
  }

  function closeAction() {
    if (pending || actionInFlight.current) {
      return;
    }

    setAction(null);
    setActionError(undefined);
  }

  function confirmAction() {
    if (!action || pending || actionInFlight.current) {
      return;
    }

    actionInFlight.current = true;
    const mutation = action.kind === 'delete' ? deleteMutation : leaveMutation;
    mutation.mutate(action.classroom.id, {
      onSuccess: () => {
        actionInFlight.current = false;
        setAction(null);
        setActionError(undefined);

        if (action?.kind === 'delete') {
          router.replace('/classrooms');
        }
      },
      onError: (error) => {
        actionInFlight.current = false;
        setActionError(
          isUnauthorizedError(error)
            ? 'Sua sessão expirou. Entre novamente.'
            : getHttpErrorMessage(error),
        );
      },
    });
  }

  if (classroomsLoading) {
    return <ScreenState kind="loading" title="Carregando turmas" message="Aguarde um momento." />;
  }

  if (classroomsError) {
    return (
      <ScreenState
        kind="error"
        title="Não foi possível carregar suas turmas"
        message="Verifique sua conexão e tente novamente."
        actionLabel="Tentar novamente"
        onAction={() => {
          void refetchClassrooms();
        }}
      />
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text accessibilityRole="header" style={styles.title}>
              Turmas
            </Text>

            <Text style={styles.subtitle}>
              Visualize suas turmas e encontre novas turmas para participar.
            </Text>
          </View>

          {user?.role === 'PROFESSOR' ? (
            <Button
              label="Criar turma"
              accessibilityLabel="Criar turma"
              style={styles.createButton}
              onPress={() => router.push('/classrooms/new')}
            />
          ) : null}
        </View>

        <FormField
          label="Buscar turmas"
          placeholder="Buscar turmas..."
          value={search}
          onChangeText={setSearch}
        />

        <Text style={styles.sectionTitle}>Minhas turmas</Text>

        {classrooms && classrooms.length > 0 ? (
          classrooms.map((classroom) => {
            const isOwner = user?.id === classroom.ownerId;

            return (
              <ClassroomCard
                key={classroom.id}
                name={classroom.name}
                teacher={classroom.teacher?.name ?? 'Professor não informado'}
                lastAnnouncement={classroom.lastAnnouncement?.title}
                actionLabel={isOwner ? 'Excluir turma' : 'Sair'}
                actionVariant="danger"
                onActionPress={() => openAction(isOwner ? 'delete' : 'leave', classroom)}
                onPress={() => router.push(`/classrooms/${classroom.id}`)}
              />
            );
          })
        ) : (
          <EmptyClassroomState />
        )}

        <Text style={styles.sectionTitle}>Turmas disponíveis</Text>

        {availableLoading ? (
          <ScreenState kind="loading" title="Buscando turmas" />
        ) : availableError ? (
          <ScreenState
            kind="error"
            title="Não foi possível buscar turmas"
            message="Verifique sua conexão e tente novamente."
            actionLabel="Tentar novamente"
            onAction={() => {
              void refetchAvailableClassrooms();
            }}
          />
        ) : availableClassrooms.length > 0 ? (
          availableClassrooms.map((classroom) => (
            <ClassroomCard
              key={classroom.id}
              name={classroom.name}
              teacher={classroom.teacher?.name ?? 'Professor não informado'}
              lastAnnouncement={classroom.lastAnnouncement?.title}
              actionLabel="Entrar"
              actionVariant="primary"
              onActionPress={() => {
                joinMutation.mutate(classroom.id);
              }}
            />
          ))
        ) : (
          <ScreenState
            kind="empty"
            title="Nenhuma turma disponível"
            message="Quando houver novas turmas, elas aparecerão aqui."
          />
        )}
      </ScrollView>

      {action ? (
        <ConfirmationDialog
          visible
          title={action.kind === 'delete' ? 'Excluir turma' : 'Sair da turma'}
          targetLabel={action.classroom.name}
          consequence={
            action.kind === 'delete'
              ? 'Participantes e comunicados serão removidos permanentemente.'
              : 'Seu acesso e sua participação serão removidos.'
          }
          variant="destructive"
          confirmLabel={action.kind === 'delete' ? 'Excluir turma' : 'Sair da turma'}
          onCancel={closeAction}
          onConfirm={confirmAction}
          pending={pending}
          errorMessage={actionError}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
  },
  header: { gap: theme.spacing.sm },
  headerContent: { gap: theme.spacing.sm },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  createButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
});
