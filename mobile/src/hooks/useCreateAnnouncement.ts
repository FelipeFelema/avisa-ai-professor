import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { announcementKeys, classroomKeys } from '@/config';
import { createAnnouncement } from '@/services/announcements';
import type { CreateAnnouncementRequest } from '@/types/announcement';
import { useSessionMutation } from '@/hooks/useSessionMutation';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useSessionMutation(
    (data: CreateAnnouncementRequest, generation) =>
      createAnnouncement(data, { sessionGeneration: generation }),
    {
      onSuccess: async (_result, variables, generation) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: announcementKeys.byClassroom(variables.classroomId),
          }),
          queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
        ]);
        if (isSessionGenerationCurrent(generation)) router.back();
      },
    },
  );
}
