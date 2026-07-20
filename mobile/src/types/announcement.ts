export type AnnouncementAuthor = {
  id: string;
  name: string;
};

export interface Announcement {
  id: string;
  classroomId: string;
  title: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  author: AnnouncementAuthor;
}

export const ANNOUNCEMENT_DURATIONS = [1, 3, 7, 15, 30] as const;

export type AnnouncementDuration = (typeof ANNOUNCEMENT_DURATIONS)[number];

export interface CreateAnnouncementRequest {
  classroomId: string;
  title: string;
  content: string;
  durationInDays: AnnouncementDuration;
}
