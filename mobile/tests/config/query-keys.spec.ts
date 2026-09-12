import { announcementKeys, authKeys, classroomKeys } from '@/config';

describe('query key factories', () => {
  it('keeps stable domain-specific keys', () => {
    expect(authKeys.profile()).toEqual(['auth', 'profile']);
    expect(classroomKeys.my()).toEqual(['classrooms', 'my']);
    expect(classroomKeys.available('mat')).toEqual(['classrooms', 'available', 'mat']);
    expect(announcementKeys.byClassroom('classroom-id')).toEqual([
      'announcements',
      'classroom',
      'classroom-id',
    ]);
  });
});
