import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { joinClassroom } from '@/services/classes/classroom.service';

export function useJoinClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClassroom,

    onSuccess: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: classroomKeys.my() }),
        queryClient.cancelQueries({ queryKey: classroomKeys.availableRoot() }),
      ]);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.availableRoot() }),
      ]);
    },
  });
}
