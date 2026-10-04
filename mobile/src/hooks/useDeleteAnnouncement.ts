import { useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { deleteAnnouncement } from '@/services/announcements';
import { useSessionMutation } from '@/hooks/useSessionMutation';

export type DeleteAnnouncementMutation = {
  announcementId: string;
  classroomId: string;
};

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useSessionMutation(
    ({ announcementId }: DeleteAnnouncementMutation, generation) =>
      deleteAnnouncement(announcementId, { sessionGeneration: generation }),
    {
      onSuccess: async (_result, variables) => {
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
    },
  );
}
