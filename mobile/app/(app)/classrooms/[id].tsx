import { StyleSheet, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AnnouncementCard } from '@/components/announcements';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { AUTH_THEME } from '@/theme/auth';

export default function ClassroomDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: announcements, isLoading } = useClassroomAnnouncements(id);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Comunicados</Text>

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
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },

  title: {
    color: AUTH_THEME.colors.text,
    textAlign: 'center',
    fontSize: AUTH_THEME.typography.sectionTitle,
    fontWeight: '700',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: AUTH_THEME.spacing.xl,
    paddingTop: AUTH_THEME.spacing.xl,
    paddingBottom: AUTH_THEME.spacing.xxxl,
    gap: AUTH_THEME.spacing.lg,
  },

  emptyText: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    textAlign: 'center',
    marginTop: AUTH_THEME.spacing.xl,
  },
});
