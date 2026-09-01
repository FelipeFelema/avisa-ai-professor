import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ClassroomCard, EmptyClassroomState } from '@/components/home';
import { ConfirmationDialog, ScreenState } from '@/components/ui';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useAuth } from '@/hooks/useAuth';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { getHttpErrorMessage, isUnauthorizedError } from '@/lib';
import { AUTH_THEME } from '@/theme/auth';
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
  const { data: availableClassrooms = [], isLoading: availableLoading } =
    useAvailableClassrooms(search);
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
            <Text style={styles.title}>Turmas</Text>

            <Text style={styles.subtitle}>
              Visualize suas turmas e encontre novas turmas para participar.
            </Text>
          </View>

          {user?.role === 'PROFESSOR' ? (
            <Pressable
              accessibilityRole="button"
              style={styles.createButton}
              onPress={() => router.push('/classrooms/new')}
            >
              <Text style={styles.createButtonText}>Criar turma</Text>
            </Pressable>
          ) : null}
        </View>

        <TextInput
          accessibilityLabel="Buscar turmas"
          style={styles.searchInput}
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
          <Text style={styles.emptyAvailable}>Nenhuma turma disponível.</Text>
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
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.lg,
    backgroundColor: AUTH_THEME.colors.background,
    flexGrow: 1,
  },
  header: { gap: AUTH_THEME.spacing.sm },
  headerContent: { gap: AUTH_THEME.spacing.sm },
  title: {
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    color: AUTH_THEME.colors.text,
  },
  subtitle: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },
  createButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: AUTH_THEME.colors.primary,
    borderRadius: AUTH_THEME.radius.md,
    paddingHorizontal: AUTH_THEME.spacing.lg,
    paddingVertical: AUTH_THEME.spacing.sm,
  },
  createButtonText: {
    color: AUTH_THEME.colors.white,
    fontSize: AUTH_THEME.typography.label,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.md,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    paddingHorizontal: AUTH_THEME.spacing.md,
    paddingVertical: AUTH_THEME.spacing.sm,
    color: AUTH_THEME.colors.text,
  },
  sectionTitle: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.sectionTitle,
    fontWeight: '700',
    marginTop: AUTH_THEME.spacing.lg,
  },
  emptyAvailable: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    textAlign: 'center',
  },
});
