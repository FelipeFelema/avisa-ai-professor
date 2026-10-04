import { useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { leaveClassroom } from '@/services/classes/classroom.service';
import { useSessionMutation } from '@/hooks/useSessionMutation';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export function useLeaveClassroom() {
  const queryClient = useQueryClient();

  return useSessionMutation(
    (classroomId: string, generation) =>
      leaveClassroom(classroomId, { sessionGeneration: generation }),
    {
      onSuccess: async (_result, _classroomId, generation) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: classroomKeys.my() }),
          queryClient.cancelQueries({ queryKey: classroomKeys.availableRoot() }),
        ]);
        if (!isSessionGenerationCurrent(generation)) return;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
          queryClient.invalidateQueries({ queryKey: classroomKeys.availableRoot() }),
          queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
        ]);
      },
    },
  );
}
