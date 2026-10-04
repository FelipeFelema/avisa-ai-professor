import { useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { updateAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';
import { useSessionMutation } from '@/hooks/useSessionMutation';

export type UpdateAnnouncementMutation = {
  announcementId: string;
  classroomId: string;
  data: Omit<CreateAnnouncementRequest, 'classroomId'>;
};

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useSessionMutation(
    ({ announcementId, data }: UpdateAnnouncementMutation, generation) =>
      updateAnnouncement(announcementId, data, { sessionGeneration: generation }),
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
