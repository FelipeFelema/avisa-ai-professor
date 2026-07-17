export interface ClassroomSummaryDto {
  id: string;
  name: string;
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
