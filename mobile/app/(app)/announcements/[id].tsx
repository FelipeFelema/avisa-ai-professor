import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAnnouncement } from '@/hooks/useAnnouncement';
import { AUTH_THEME } from '@/theme/auth';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';

export default function AnnouncementDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { user } = useAuth();

  const { data: announcement, isLoading } = useAnnouncement(id);

  const { mutateAsync: deleteAnnouncement } = useDeleteAnnouncement();

  const isAuthor = user?.id === announcement?.author.id;

  if (isLoading || !announcement) {
    return null;
  }

  const announcementId = announcement.id;

  async function handleDelete() {
    Alert.alert('Excluir comunicado', 'Deseja realmente excluir este comunicado?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteAnnouncement(announcementId);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{announcement.title}</Text>

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
            <Pressable
              style={styles.editButton}
              onPress={() => router.push(`/classrooms/${announcement.id}/edit`)}
            >
              <Text style={styles.editButtonText}>Editar</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Excluir</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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

  editButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: AUTH_THEME.spacing.md,
    borderRadius: AUTH_THEME.radius.md,
    backgroundColor: AUTH_THEME.colors.primary,
  },

  deleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: AUTH_THEME.spacing.md,
    borderRadius: AUTH_THEME.radius.md,
    backgroundColor: '#DC2626',
  },

  editButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  deleteButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
