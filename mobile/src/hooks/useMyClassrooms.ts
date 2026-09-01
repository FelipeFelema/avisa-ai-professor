import { useQuery } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { getMyClassrooms } from '@/services/classes/classroom.service';

export function useMyClassrooms() {
  return useQuery({
    queryKey: classroomKeys.my(),
    queryFn: getMyClassrooms,
  });
}
