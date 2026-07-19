import { StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyClassroomState, HomeHeader, ClassroomCard } from '@/components/home';
import { useAuth } from '@/hooks/useAuth';
import { AUTH_THEME } from '@/theme/auth';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: classrooms, isLoading } = useMyClassrooms();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HomeHeader name={user?.name ?? 'Usuário'} />

      {isLoading ? null : classrooms && classrooms.length > 0 ? (
        classrooms.map((classroom) => (
          <ClassroomCard
            key={classroom.id}
            name={classroom.name}
            teacher={classroom.teacher?.name ?? 'Professor não informado'}
            lastAnnouncement={classroom.lastAnnouncement?.title}
            onPress={() => router.push(`/classrooms/${classroom.id}`)}
          />
        ))
      ) : (
        <EmptyClassroomState onPress={() => router.push('/classrooms')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    backgroundColor: AUTH_THEME.colors.background,
    paddingHorizontal: AUTH_THEME.spacing.xl,
    paddingTop: AUTH_THEME.spacing.xxl,
    gap: AUTH_THEME.spacing.xxxl,
  },
});
