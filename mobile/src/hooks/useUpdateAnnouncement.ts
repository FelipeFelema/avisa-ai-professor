import { useMutation, useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { updateAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';

export type UpdateAnnouncementMutation = {
  announcementId: string;
  classroomId: string;
  data: Omit<CreateAnnouncementRequest, 'classroomId'>;
};

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ announcementId, data }: UpdateAnnouncementMutation) =>
      updateAnnouncement(announcementId, data),
    retry: false,

    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: announcementKeys.detail(variables.announcementId),
        }),
        queryClient.invalidateQueries({
          queryKey: announcementKeys.byClassroom(variables.classroomId),
        }),
        queryClient.invalidateQueries({
          queryKey: classroomKeys.my(),
        }),
      ]);
    },
  });
}
