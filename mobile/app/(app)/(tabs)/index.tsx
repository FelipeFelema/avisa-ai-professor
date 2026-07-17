import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyClassroomState, HomeHeader } from '@/components/home';
import { useAuth } from '@/hooks/useAuth';
import { AUTH_THEME } from '@/theme/auth';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <HomeHeader name={user?.name ?? 'Usuário'} />

      <EmptyClassroomState onPress={() => router.push('/classrooms')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
    paddingHorizontal: AUTH_THEME.spacing.xl,
    paddingTop: AUTH_THEME.spacing.xxl,
    gap: AUTH_THEME.spacing.xxxl,
  },
});
