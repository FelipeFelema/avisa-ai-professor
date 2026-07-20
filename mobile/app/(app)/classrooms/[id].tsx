import { Pressable, ScrollView, View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnnouncementCard } from '@/components/announcements';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { AUTH_THEME } from '@/theme/auth';

export default function ClassroomDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: announcements, isLoading } = useClassroomAnnouncements(id);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Comunicados</Text>

          {user?.role === 'PROFESSOR' && (
            <Pressable
              style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
              onPress={() => router.push(`/classrooms/${id}/new-announcement`)}
            >
              <Text style={styles.createButtonText}>+ Novo</Text>
            </Pressable>
          )}
        </View>

        {!isLoading && announcements?.length === 0 ? (
          <Text style={styles.emptyText}>Ainda não existem comunicados para esta turma.</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },

  safeArea: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: AUTH_THEME.spacing.xl,
    paddingTop: AUTH_THEME.spacing.xl,
    paddingBottom: AUTH_THEME.spacing.xxxl,
    gap: AUTH_THEME.spacing.lg,
  },

  title: {
    color: AUTH_THEME.colors.text,
    textAlign: 'center',
    fontSize: AUTH_THEME.typography.sectionTitle,
    fontWeight: '700',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AUTH_THEME.spacing.md,
  },

  createButton: {
    backgroundColor: AUTH_THEME.colors.primary,
    paddingHorizontal: AUTH_THEME.spacing.md,
    paddingVertical: AUTH_THEME.spacing.xs,
    borderRadius: AUTH_THEME.radius.md,
  },

  createButtonPressed: {
    opacity: 0.9,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: AUTH_THEME.typography.label,
  },

  emptyText: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    textAlign: 'center',
    marginTop: AUTH_THEME.spacing.xl,
  },
});
