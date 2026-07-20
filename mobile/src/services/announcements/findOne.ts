import { api } from '@/lib';
import type { Announcement } from '@/types/announcement';

export async function findOne(id: string): Promise<Announcement> {
  const response = await api.get<Announcement>(`/announcements/${id}`);

  return response.data;
}
