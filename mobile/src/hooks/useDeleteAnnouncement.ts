import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { deleteAnnouncement } from '@/services/announcements';

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: deleteAnnouncement,

    onSuccess: async (_, announcementId) => {
      await queryClient.invalidateQueries({
        queryKey: ['announcement', announcementId],
      });

      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'classroom-announcements',
      });

      await queryClient.invalidateQueries({
        queryKey: ['my-classrooms'],
      });

      router.back();
    },
  });
}
