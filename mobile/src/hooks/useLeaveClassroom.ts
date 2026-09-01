import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { leaveClassroom } from '@/services/classes/classroom.service';

export function useLeaveClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveClassroom,

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
