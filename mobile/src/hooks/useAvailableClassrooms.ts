import { useQuery } from '@tanstack/react-query';

import { classroomKeys } from '@/config';
import { getAvailableClassrooms } from '@/services/classes/classroom.service';

export function useAvailableClassrooms(search?: string, options: { enabled?: boolean } = {}) {
  const normalizedSearch = search?.trim() ?? '';

  return useQuery({
    queryKey: classroomKeys.available(normalizedSearch),
    queryFn: ({ signal }) => getAvailableClassrooms(normalizedSearch, signal),
    enabled: options.enabled ?? true,
  });
}
