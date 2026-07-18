import { api } from '@/lib';
import type { ClassroomSummary } from '@/types/classroom';

export async function getMyClassrooms(): Promise<ClassroomSummary[]> {
  const response = await api.get<ClassroomSummary[]>('/classrooms/my');

  return response.data;
}
