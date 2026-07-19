import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ClassroomCard, EmptyClassroomState } from '@/components/home';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { AUTH_THEME } from '@/theme/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';

export default function ClassroomsScreen() {
  const [search, setSearch] = useState('');
  const { data: availableClassrooms = [] } = useAvailableClassrooms(search);
  const { data: classrooms, isLoading } = useMyClassrooms();
  const router = useRouter();
  const joinMutation = useJoinClassroom();
  const leaveMutation = useLeaveClassroom();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Turmas</Text>

        <Text style={styles.subtitle}>
          Visualize suas turmas e encontre novas turmas para participar.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar turmas..."
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.sectionTitle}>Minhas turmas</Text>

      {isLoading ? null : classrooms && classrooms.length > 0 ? (
        classrooms.map((classroom) => (
          <ClassroomCard
            key={classroom.id}
            name={classroom.name}
            teacher={classroom.teacher?.name ?? 'Professor não informado'}
            lastAnnouncement={classroom.lastAnnouncement?.title}
            actionLabel="Sair"
            actionVariant="danger"
            onActionPress={() => {
              leaveMutation.mutate(classroom.id);
            }}
            onPress={() => {
              router.push(`/classrooms/${classroom.id}`);
            }}
          />
        ))
      ) : (
        <EmptyClassroomState />
      )}

      <Text style={styles.sectionTitle}>Turmas disponíveis</Text>

      {availableClassrooms.map((classroom) => (
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
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.lg,
    backgroundColor: AUTH_THEME.colors.background,
    flexGrow: 1,
  },

  header: {
    gap: AUTH_THEME.spacing.sm,
  },

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
});
