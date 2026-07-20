import { useQuery } from '@tanstack/react-query';

import * as announcementsService from '@/services/announcements';

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsService.findOne(id),
    enabled: !!id,
  });
}
