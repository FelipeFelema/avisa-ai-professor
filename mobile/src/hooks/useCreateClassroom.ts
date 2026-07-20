import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createClassroom } from '@/services/classes/classroom.service';
import type { CreateClassroomRequest } from '@/types/classroom';

export function useCreateClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClassroomRequest) => createClassroom(data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      await queryClient.invalidateQueries({ queryKey: ['available-classrooms'] });
    },
  });
}
