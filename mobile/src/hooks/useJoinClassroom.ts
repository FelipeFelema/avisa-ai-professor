import { useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { joinClassroom } from '@/services/classes/classroom.service';
import { useSessionMutation } from '@/hooks/useSessionMutation';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export function useJoinClassroom() {
  const queryClient = useQueryClient();

  return useSessionMutation(
    (classroomId: string, generation) =>
      joinClassroom(classroomId, { sessionGeneration: generation }),
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
        ]);
      },
    },
  );
}
