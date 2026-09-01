export interface ClassroomSummaryDto {
  id: string;
  name: string;
  ownerId: string;
  teacher: {
    id: string;
    name: string;
  } | null;
  lastAnnouncement: {
    id: string;
    title: string;
    createdAt: Date;
  } | null;
}
