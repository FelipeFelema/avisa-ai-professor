import { useQuery } from '@tanstack/react-query';

import { getAvailableClassrooms } from '@/services/classes/classroom.service';

export function useAvailableClassrooms(search?: string) {
  return useQuery({
    queryKey: ['available-classrooms', search],
    queryFn: () => getAvailableClassrooms(search),
  });
}
