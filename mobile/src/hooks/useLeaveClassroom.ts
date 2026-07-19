import { useMutation, useQueryClient } from '@tanstack/react-query';

import { leaveClassroom } from '@/services/classes/classroom.service';

export function useLeaveClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveClassroom,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['my-classrooms'],
      });

      queryClient.invalidateQueries({
        queryKey: ['available-classrooms'],
      });
    },
  });
}
