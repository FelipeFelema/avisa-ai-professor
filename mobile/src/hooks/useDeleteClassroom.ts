import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { announcementKeys, classroomKeys } from '@/config';
import { deleteClassroom } from '@/services/classes/classroom.service';
import { useSessionMutation } from '@/hooks/useSessionMutation';
import { isSessionGenerationCurrent } from '@/lib/session-generation';

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const mutation = useSessionMutation(
    (classroomId: string, generation) =>
      deleteClassroom(classroomId, { sessionGeneration: generation }),
    {
      onSuccess: async (_result, classroomId, generation) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: classroomKeys.my() }),
          queryClient.cancelQueries({ queryKey: classroomKeys.availableRoot() }),
        ]);
        if (!isSessionGenerationCurrent(generation)) return;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: classroomKeys.my() }),
          queryClient.invalidateQueries({ queryKey: classroomKeys.availableRoot() }),
          queryClient.invalidateQueries({
            queryKey: announcementKeys.byClassroom(classroomId),
          }),
        ]);
      },
      onSettledAny: () => {
        inFlightRef.current = false;
      },
    },
  );

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
