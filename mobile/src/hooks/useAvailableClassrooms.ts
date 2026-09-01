import { useQuery } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { getAvailableClassrooms } from '@/services/classes/classroom.service';

export function useAvailableClassrooms(search?: string) {
  return useQuery({
    queryKey: classroomKeys.available(search),
    queryFn: () => getAvailableClassrooms(search),
  });
}
