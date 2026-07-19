import { useMutation, useQueryClient } from '@tanstack/react-query';

import { joinClassroom } from '@/services/classes/classroom.service';

export function useJoinClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClassroom,

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
