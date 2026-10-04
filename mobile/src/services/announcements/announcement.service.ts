import { api } from '@/lib';
import {
  assertSessionGeneration,
  getSessionGeneration,
  type PrivateRequestOptions,
} from '@/lib/session-generation';
import type { Announcement, CreateAnnouncementRequest } from '@/types/announcement';

export async function createAnnouncement(
  data: CreateAnnouncementRequest,
  options: PrivateRequestOptions = {},
): Promise<Announcement> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.post<Announcement>('/announcements', data, {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function findByClassroom(
  classroomId: string,
  options: PrivateRequestOptions = {},
): Promise<Announcement[]> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.get<Announcement[]>(`/announcements/classrooms/${classroomId}`, {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function findOne(
  id: string,
  options: PrivateRequestOptions = {},
): Promise<Announcement> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.get<Announcement>(`/announcements/${id}`, {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function updateAnnouncement(
  announcementId: string,
  data: Omit<CreateAnnouncementRequest, 'classroomId'>,
  options: PrivateRequestOptions = {},
): Promise<Announcement> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  const response = await api.patch<Announcement>(`/announcements/${announcementId}`, data, {
    ...options,
    sessionGeneration: generation,
  });
  assertSessionGeneration(generation);

  return response.data;
}

export async function deleteAnnouncement(
  id: string,
  options: PrivateRequestOptions = {},
): Promise<void> {
  const generation = options.sessionGeneration ?? getSessionGeneration();
  await api.delete(`/announcements/${id}`, { ...options, sessionGeneration: generation });
  assertSessionGeneration(generation);
}
