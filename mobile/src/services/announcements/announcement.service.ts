import { api } from '@/lib';
import type { Announcement, CreateAnnouncementRequest } from '@/types/announcement';

export async function createAnnouncement(data: CreateAnnouncementRequest): Promise<Announcement> {
  const response = await api.post<Announcement>('/announcements', data);

  return response.data;
}

export async function findByClassroom(classroomId: string): Promise<Announcement[]> {
  const response = await api.get<Announcement[]>(`/announcements/classrooms/${classroomId}`);

  return response.data;
}

export async function findOne(id: string): Promise<Announcement> {
  const response = await api.get<Announcement>(`/announcements/${id}`);

  return response.data;
}

export async function updateAnnouncement(
  announcementId: string,
  data: Omit<CreateAnnouncementRequest, 'classroomId'>,
): Promise<Announcement> {
  const response = await api.patch<Announcement>(`/announcements/${announcementId}`, data);

  return response.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}
