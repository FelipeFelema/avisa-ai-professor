import { useMutation, useQueryClient } from '@tanstack/react-query';

import { announcementKeys, classroomKeys } from '@/config';
import { leaveClassroom } from '@/services/classes/classroom.service';

export function useLeaveClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveClassroom,
    retry: false,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: classroomKeys.my(),
        }),
        queryClient.invalidateQueries({
          queryKey: classroomKeys.available(),
        }),
        queryClient.invalidateQueries({
          queryKey: announcementKeys.all,
        }),
      ]);
    },
  });
}
