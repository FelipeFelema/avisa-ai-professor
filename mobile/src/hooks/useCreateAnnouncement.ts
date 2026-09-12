import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { announcementKeys, classroomKeys } from '@/config';
import { createAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateAnnouncementRequest) => createAnnouncement(data),

    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: announcementKeys.byClassroom(variables.classroomId),
        }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
      ]);

      router.back();
    },
  });
}
