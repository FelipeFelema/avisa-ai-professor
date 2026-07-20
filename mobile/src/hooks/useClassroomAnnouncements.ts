import { useQuery } from '@tanstack/react-query';

import * as announcementsService from '@/services/announcements/service';

export function useClassroomAnnouncements(classroomId: string) {
  return useQuery({
    queryKey: ['classroom-announcements', classroomId],
    queryFn: () => announcementsService.findByClassroom(classroomId),
    enabled: !!classroomId,
  });
}
