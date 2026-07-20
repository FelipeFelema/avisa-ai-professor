import { api } from '@/lib';
import type { CreateAnnouncementRequest } from '@/types/announcement';

export async function createAnnouncement(data: CreateAnnouncementRequest) {
  const response = await api.post('/announcements', data);

  return response.data;
}

export async function updateAnnouncement(
  announcementId: string,
  data: Omit<CreateAnnouncementRequest, 'classroomId'>,
) {
  const response = await api.patch(`/announcements/${announcementId}`, data);

  return response.data;
}

export async function deleteAnnouncement(id: string) {
  await api.delete(`/announcements/${id}`);
}
