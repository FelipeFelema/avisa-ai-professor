import { api } from '@/lib';
import type { ClassroomSummary, CreateClassroomRequest } from '@/types/classroom';

export async function createClassroom(data: CreateClassroomRequest): Promise<void> {
  await api.post('/classrooms', data);
}

export async function getMyClassrooms(): Promise<ClassroomSummary[]> {
  const response = await api.get<ClassroomSummary[]>('/classrooms/my');

  return response.data;
}

export async function getAvailableClassrooms(
  search?: string,
  signal?: AbortSignal,
): Promise<ClassroomSummary[]> {
  const normalizedSearch = search?.trim();
  const config = {
    ...(normalizedSearch ? { params: { search: normalizedSearch } } : {}),
    ...(signal ? { signal } : {}),
  };
  const response =
    Object.keys(config).length > 0
      ? await api.get<ClassroomSummary[]>('/classrooms', config)
      : await api.get<ClassroomSummary[]>('/classrooms');

  return response.data;
}

export async function joinClassroom(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/join`);
}

export async function leaveClassroom(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/leave`);
}

export async function deleteClassroom(classroomId: string): Promise<void> {
  await api.delete(`/classrooms/${classroomId}`);
}
