import { useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { createClassroom } from '@/services/classes/classroom.service';
import type { CreateClassroomRequest } from '@/types/classroom';
import { useSessionMutation } from '@/hooks/useSessionMutation';

export function useCreateClassroom() {
  const queryClient = useQueryClient();

  return useSessionMutation(
    (data: CreateClassroomRequest, generation) =>
      createClassroom(data, { sessionGeneration: generation }),
    {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
          queryClient.invalidateQueries({ queryKey: classroomKeys.available() }),
        ]);
      },
    },
  );
}
