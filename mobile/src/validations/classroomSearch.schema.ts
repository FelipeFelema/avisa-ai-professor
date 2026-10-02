import { z } from 'zod';

export const CLASSROOM_SEARCH_MAX_CODE_POINTS = 80;
export const CLASSROOM_SEARCH_ERROR_MESSAGE = 'Use até 80 caracteres na pesquisa';

export function normalizeClassroomSearch(value: string): string {
  return value.trim();
}

export const classroomSearchSchema = z
  .string()
  .transform(normalizeClassroomSearch)
  .refine((value) => Array.from(value).length <= CLASSROOM_SEARCH_MAX_CODE_POINTS, {
    message: CLASSROOM_SEARCH_ERROR_MESSAGE,
  });

export type ClassroomSearch = z.infer<typeof classroomSearchSchema>;
