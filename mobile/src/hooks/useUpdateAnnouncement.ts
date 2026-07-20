import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { updateAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';

type UpdateAnnouncementMutation = {
  announcementId: string;
  classroomId: string;
  data: Omit<CreateAnnouncementRequest, 'classroomId'>;
};

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ announcementId, data }: UpdateAnnouncementMutation) =>
      updateAnnouncement(announcementId, data),

    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['announcement', variables.announcementId],
      });

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
