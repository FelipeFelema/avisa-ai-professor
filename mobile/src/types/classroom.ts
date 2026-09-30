export interface ClassroomSummary {
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
    createdAt: string;
    expiresAt: string;
  } | null;
}

export interface CreateClassroomRequest {
  name: string;
}
