import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { ClassroomCard, EmptyClassroomState, HomeHeader } from '@/components/home';
import { ScreenState } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useTheme } from '@/hooks/useTheme';
import { getAuthTheme } from '@/theme/auth';

export default function HomeScreen() {
  const { palette: theme } = useTheme();
  const AUTH_THEME = getAuthTheme(theme);
  const styles = createStyles(AUTH_THEME);

  const router = useRouter();
  const { user } = useAuth();
  const { data: classrooms, isLoading, isError, refetch } = useMyClassrooms();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HomeHeader name={user?.name ?? 'Usuário'} />

      {isLoading ? (
        <ScreenState kind="loading" title="Carregando suas turmas" message="Aguarde um momento." />
      ) : isError ? (
        <ScreenState
          kind="error"
          title="Não foi possível carregar suas turmas"
          message="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={() => {
            void refetch();
          }}
        />
      ) : classrooms && classrooms.length > 0 ? (
        classrooms.map((classroom) => (
          <ClassroomCard
            key={classroom.id}
            name={classroom.name}
            teacher={classroom.teacher?.name ?? 'Professor não informado'}
            lastAnnouncement={classroom.lastAnnouncement?.title}
            announcementExpiresAt={classroom.lastAnnouncement?.expiresAt}
            onPress={() => router.push(`/classrooms/${classroom.id}`)}
          />
        ))
      ) : (
        <EmptyClassroomState onPress={() => router.push('/classrooms')} />
      )}
    </ScrollView>
  );
}

function createStyles(AUTH_THEME: ReturnType<typeof getAuthTheme>) {
  return StyleSheet.create({
    content: {
      flexGrow: 1,
      backgroundColor: AUTH_THEME.colors.background,
      paddingHorizontal: AUTH_THEME.spacing.xl,
      paddingTop: AUTH_THEME.spacing.xxl,
      gap: AUTH_THEME.spacing.xxxl,
    },
  });
}
