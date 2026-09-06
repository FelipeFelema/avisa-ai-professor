import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { createClassroom } from '@/services/classes/classroom.service';
import type { CreateClassroomRequest } from '@/types/classroom';

export function useCreateClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClassroomRequest) => createClassroom(data),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.available() }),
      ]);
    },
  });
}
