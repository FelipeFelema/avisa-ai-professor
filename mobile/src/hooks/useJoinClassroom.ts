import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { joinClassroom } from '@/services/classes/classroom.service';

export function useJoinClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClassroom,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: classroomKeys.my(),
      });

      queryClient.invalidateQueries({
        queryKey: classroomKeys.available(),
      });
    },
  });
}
