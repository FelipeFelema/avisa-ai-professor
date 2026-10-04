import { api } from '@/lib';
import {
  assertSessionGeneration,
  getSessionGeneration,
  type PrivateRequestOptions,
} from '@/lib/session-generation';
import type { ClassroomSummary, CreateClassroomRequest } from '@/types/classroom';

export async function createClassroom(
  data: CreateClassroomRequest,
  requestOptions: PrivateRequestOptions = {},
): Promise<void> {
  const generation = requestOptions.sessionGeneration ?? getSessionGeneration();
  await api.post('/classrooms', data, { ...requestOptions, sessionGeneration: generation });
  assertSessionGeneration(generation);
}

export async function getMyClassrooms(
  requestOptions: PrivateRequestOptions = {},
): Promise<ClassroomSummary[]> {
  const generation = requestOptions.sessionGeneration ?? getSessionGeneration();
  const response = await api.get<ClassroomSummary[]>('/classrooms/my', {
    ...requestOptions,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function getAvailableClassrooms(
  search?: string,
  signal?: AbortSignal,
  sessionGeneration = getSessionGeneration(),
): Promise<ClassroomSummary[]> {
  const normalizedSearch = search?.trim();
  const config = {
    ...(normalizedSearch ? { params: { search: normalizedSearch } } : {}),
    ...(signal ? { signal } : {}),
    sessionGeneration,
  };
  const response =
    Object.keys(config).length > 0
      ? await api.get<ClassroomSummary[]>('/classrooms', config)
      : await api.get<ClassroomSummary[]>('/classrooms');
  assertSessionGeneration(sessionGeneration);

  return response.data;
}

export async function joinClassroom(
  classroomId: string,
  requestOptions: PrivateRequestOptions = {},
): Promise<void> {
  const generation = requestOptions.sessionGeneration ?? getSessionGeneration();
  await api.post(`/classrooms/${classroomId}/join`, undefined, {
    ...requestOptions,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);
}

export async function leaveClassroom(
  classroomId: string,
  requestOptions: PrivateRequestOptions = {},
): Promise<void> {
  const generation = requestOptions.sessionGeneration ?? getSessionGeneration();
  await api.post(`/classrooms/${classroomId}/leave`, undefined, {
    ...requestOptions,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);
}

export async function deleteClassroom(
  classroomId: string,
  requestOptions: PrivateRequestOptions = {},
): Promise<void> {
  const generation = requestOptions.sessionGeneration ?? getSessionGeneration();
  await api.delete(`/classrooms/${classroomId}`, {
    ...requestOptions,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);
}
