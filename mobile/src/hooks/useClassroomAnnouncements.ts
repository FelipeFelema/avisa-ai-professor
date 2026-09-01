import { useQuery } from '@tanstack/react-query';

import { announcementKeys } from '@/config';
import * as announcementsService from '@/services/announcements/service';

export function useClassroomAnnouncements(classroomId: string) {
  return useQuery({
    queryKey: announcementKeys.byClassroom(classroomId),
    queryFn: () => announcementsService.findByClassroom(classroomId),
    enabled: !!classroomId,
  });
}
