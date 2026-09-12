import { useQuery } from '@tanstack/react-query';

import { announcementKeys } from '@/config';
import * as announcementsService from '@/services/announcements';

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: () => announcementsService.findOne(id),
    enabled: !!id,
  });
}
