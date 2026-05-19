export type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  author: {
    id: string;
    name: string;
  };
};
