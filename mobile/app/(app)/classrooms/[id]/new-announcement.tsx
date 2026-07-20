import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateAnnouncement } from '@/hooks/useCreateAnnouncement';

import {
  createAnnouncementSchema,
  type CreateAnnouncementFormData,
} from '@/validations/createAnnouncementSchema';
import { ANNOUNCEMENT_DURATIONS } from '@/types/announcement';

import { AUTH_THEME } from '@/theme/auth';

export default function NewAnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAnnouncementFormData>({
    resolver: zodResolver(createAnnouncementSchema),

    defaultValues: {
      title: '',
      content: '',
      durationInDays: 7,
    },
  });

  const createAnnouncement = useCreateAnnouncement();

  const onSubmit = async (data: CreateAnnouncementFormData) => {
    await createAnnouncement.mutateAsync({
      classroomId: id,
      ...data,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Novo comunicado</Text>
        <Text style={styles.subtitle}>
          Preencha os campos abaixo para criar um novo comunicado para a turma.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Título</Text>

          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Digite o título"
                placeholderTextColor={AUTH_THEME.colors.muted}
                style={styles.input}
              />
            )}
          />

          {errors.title && <Text style={styles.error}>{errors.title.message}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Conteúdo</Text>

          <Controller
            control={control}
            name="content"
            render={({ field: { value, onChange } }) => (
              <TextInput
                multiline
                textAlignVertical="top"
                scrollEnabled
                maxLength={2000}
                value={value}
                onChangeText={onChange}
                placeholder="Digite o comunicado..."
                placeholderTextColor={AUTH_THEME.colors.muted}
                style={styles.textArea}
              />
            )}
          />

          {errors.content && <Text style={styles.error}>{errors.content.message}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Duração</Text>

          <Controller
            control={control}
            name="durationInDays"
            render={({ field: { value, onChange } }) => (
              <View style={styles.durationContainer}>
                {ANNOUNCEMENT_DURATIONS.map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => onChange(days)}
                    style={[styles.durationChip, value === days && styles.selectedDurationChip]}
                  >
                    <Text
                      style={[styles.durationText, value === days && styles.selectedDurationText]}
                    >
                      {days} {days === 1 ? 'dia' : 'dias'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        <Pressable
          style={styles.submitButton}
          onPress={handleSubmit(onSubmit)}
          disabled={createAnnouncement.isPending}
        >
          <Text style={styles.submitText}>
            {createAnnouncement.isPending ? 'Publicando...' : 'Publicar comunicado'}
          </Text>
        </Pressable>
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
    gap: AUTH_THEME.spacing.xl,
  },

  title: {
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    color: AUTH_THEME.colors.text,
    textAlign: 'center',
  },

  subtitle: {
    textAlign: 'center',
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },

  field: {
    gap: AUTH_THEME.spacing.sm,
  },

  label: {
    color: AUTH_THEME.colors.text,
    fontWeight: '700',
    fontSize: AUTH_THEME.typography.body,
  },

  input: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.md,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.md,
    color: AUTH_THEME.colors.text,
  },

  textArea: {
    minHeight: 180,
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.md,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    padding: AUTH_THEME.spacing.md,
    color: AUTH_THEME.colors.text,
  },

  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AUTH_THEME.spacing.sm,
  },

  durationChip: {
    paddingHorizontal: AUTH_THEME.spacing.lg,
    paddingVertical: AUTH_THEME.spacing.sm,
    borderRadius: AUTH_THEME.radius.pill,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    backgroundColor: AUTH_THEME.colors.surface,
  },

  durationText: {
    color: AUTH_THEME.colors.text,
    fontWeight: '600',
  },

  submitButton: {
    backgroundColor: AUTH_THEME.colors.primary,
    borderRadius: AUTH_THEME.radius.md,
    paddingVertical: AUTH_THEME.spacing.md,
    alignItems: 'center',
    marginTop: AUTH_THEME.spacing.xl,
  },

  submitText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: AUTH_THEME.typography.body,
  },

  selectedDurationChip: {
    backgroundColor: AUTH_THEME.colors.primary,
    borderColor: AUTH_THEME.colors.primary,
  },

  selectedDurationText: {
    color: '#FFF',
  },

  error: {
    color: '#DC2626',
    fontSize: AUTH_THEME.typography.caption,
    marginTop: AUTH_THEME.spacing.xs,
  },
});
