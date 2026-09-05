import { useMutation, useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { deleteAnnouncement } from '@/services/announcements';

export type DeleteAnnouncementMutation = {
  announcementId: string;
  classroomId: string;
};

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ announcementId }: DeleteAnnouncementMutation) =>
      deleteAnnouncement(announcementId),
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
