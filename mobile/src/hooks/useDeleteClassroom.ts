import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { deleteClassroom } from '@/services/classes/classroom.service';

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (classroomId: string) => deleteClassroom(classroomId),
    retry: false,
    onSuccess: async (_, classroomId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
        queryClient.invalidateQueries({ queryKey: classroomKeys.available() }),
        queryClient.invalidateQueries({
          queryKey: announcementKeys.byClassroom(classroomId),
        }),
      ]);
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const mutate = (classroomId: string, options?: Parameters<typeof mutation.mutate>[1]) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    mutation.mutate(classroomId, options);
  };

  const mutateAsync = async (
    classroomId: string,
    options?: Parameters<typeof mutation.mutateAsync>[1],
  ) => {
    if (inFlightRef.current) {
      return undefined;
    }

    inFlightRef.current = true;

    try {
      return await mutation.mutateAsync(classroomId, options);
    } finally {
      inFlightRef.current = false;
    }
  };

  return { ...mutation, mutate, mutateAsync };
}
