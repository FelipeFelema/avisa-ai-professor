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

  it('shares available variants after external trim while preserving internal text and other domains', () => {
    const availableRoot = classroomKeys.availableRoot();
    expect(availableRoot).toEqual(['classrooms', 'available']);
    expect(classroomKeys.available()).toEqual(['classrooms', 'available', '']);
    expect(classroomKeys.available('')).toEqual(['classrooms', 'available', '']);
    expect(classroomKeys.available('   ')).toEqual(['classrooms', 'available', '']);
    expect(classroomKeys.available('  Matemática  ')).toEqual([
      'classrooms',
      'available',
      'Matemática',
    ]);
    expect(classroomKeys.available('Matemática 6º A')).toEqual([
      'classrooms',
      'available',
      'Matemática 6º A',
    ]);
    expect(classroomKeys.available('matemática')).not.toEqual(
      classroomKeys.available('Matemática'),
    );
    expect(classroomKeys.my()).toEqual(['classrooms', 'my']);
    expect(classroomKeys.detail('classroom-id')).toEqual(['classrooms', 'detail', 'classroom-id']);
    for (const key of [
      classroomKeys.available(),
      classroomKeys.available('matemática'),
      classroomKeys.available(' história '),
    ]) {
      expect(key.slice(0, availableRoot.length)).toEqual(availableRoot);
    }
    expect(classroomKeys.my().slice(0, availableRoot.length)).not.toEqual(availableRoot);
    expect(classroomKeys.detail('classroom-id').slice(0, availableRoot.length)).not.toEqual(
      availableRoot,
    );
    expect(announcementKeys.byClassroom('classroom-id')).toEqual([
      'announcements',
      'classroom',
      'classroom-id',
    ]);
  });
});
