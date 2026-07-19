export type AnnouncementAuthor = {
  id: string;
  name: string;
};

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  author: AnnouncementAuthor;
}
