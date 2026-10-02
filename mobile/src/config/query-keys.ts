export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
};

export const classroomKeys = {
  all: ['classrooms'] as const,
  my: () => [...classroomKeys.all, 'my'] as const,
  availableRoot: () => [...classroomKeys.all, 'available'] as const,
  available: (search?: string) => [...classroomKeys.availableRoot(), search?.trim() ?? ''] as const,
  detail: (id: string) => [...classroomKeys.all, 'detail', id] as const,
};

export const announcementKeys = {
  all: ['announcements'] as const,
  byClassroom: (classroomId: string) =>
    [...announcementKeys.all, 'classroom', classroomId] as const,
  detail: (id: string) => [...announcementKeys.all, 'detail', id] as const,
};
