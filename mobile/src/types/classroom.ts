export interface ClassroomSummary {
  id: string;
  name: string;

  teacher: {
    id: string;
    name: string;
  } | null;

  lastAnnouncement: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
}

export interface CreateClassroomRequest {
  name: string;
}
