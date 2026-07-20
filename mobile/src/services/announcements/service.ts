import { api } from '@/lib';

import type { Announcement } from '@/types/announcement';

export async function findByClassroom(classroomId: string): Promise<Announcement[]> {
  const response = await api.get<Announcement[]>(`/announcements/classrooms/${classroomId}`);
  return response.data;
}
