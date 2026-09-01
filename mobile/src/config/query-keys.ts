export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
};

export const classroomKeys = {
  all: ['classrooms'] as const,
  my: () => [...classroomKeys.all, 'my'] as const,
  available: (search?: string) => [...classroomKeys.all, 'available', search ?? ''] as const,
  detail: (id: string) => [...classroomKeys.all, 'detail', id] as const,
};

export const announcementKeys = {
  all: ['announcements'] as const,
  byClassroom: (classroomId: string) =>
    [...announcementKeys.all, 'classroom', classroomId] as const,
  detail: (id: string) => [...announcementKeys.all, 'detail', id] as const,
};
