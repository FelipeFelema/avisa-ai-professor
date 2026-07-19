import { api } from '@/lib';
import type { ClassroomSummary } from '@/types/classroom';

export async function getMyClassrooms(): Promise<ClassroomSummary[]> {
  const response = await api.get<ClassroomSummary[]>('/classrooms/my');

  return response.data;
}

export async function getAvailableClassrooms(search?: string): Promise<ClassroomSummary[]> {
  const response = await api.get<ClassroomSummary[]>('/classrooms', {
    params: {
      search,
    },
  });

  return response.data;
}

export async function joinClassroom(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/join`);
}

export async function leaveClassroom(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/leave`);
}
