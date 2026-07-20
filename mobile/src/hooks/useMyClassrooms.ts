import { useQuery } from '@tanstack/react-query';

import { getMyClassrooms } from '@/services/classes/classroom.service';

export function useMyClassrooms() {
  return useQuery({
    queryKey: ['my-classrooms'],
    queryFn: getMyClassrooms,
  });
}
