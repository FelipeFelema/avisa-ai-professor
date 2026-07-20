import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { createAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateAnnouncementRequest) => createAnnouncement(data),

    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['classroom-announcements', variables.classroomId],
      });

      await queryClient.invalidateQueries({
        queryKey: ['my-classrooms'],
      });

      router.back();
    },
  });
}
