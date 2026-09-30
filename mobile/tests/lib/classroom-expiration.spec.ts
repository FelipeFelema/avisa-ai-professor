import { getClassroomAnnouncementExpirationLabel } from '@/lib/classroom-expiration';

const referenceNow = new Date(2026, 8, 29, 12, 0, 0, 0);

function localDateIso(dayOffset: number, hour: number) {
  const date = new Date(referenceNow);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

describe('getClassroomAnnouncementExpirationLabel', () => {
  it('returns the today label for an active announcement on the same local date', () => {
    expect(getClassroomAnnouncementExpirationLabel(localDateIso(0, 23), referenceNow)).toBe(
      'Expira hoje',
    );
  });

  it('counts the next local calendar date as one day even across midnight', () => {
    const now = new Date(2026, 8, 29, 23, 59, 0, 0);
    const expiresAt = new Date(2026, 8, 30, 0, 1, 0, 0).toISOString();

    expect(getClassroomAnnouncementExpirationLabel(expiresAt, now)).toBe('Expira em 1 dia');
  });

  it('returns the plural label for multiple local calendar days', () => {
    expect(getClassroomAnnouncementExpirationLabel(localDateIso(4, 9), referenceNow)).toBe(
      'Expira em 4 dias',
    );
  });

  it('returns null for missing, invalid, and already expired timestamps', () => {
    expect(getClassroomAnnouncementExpirationLabel(undefined, referenceNow)).toBeNull();
    expect(getClassroomAnnouncementExpirationLabel('not-a-date', referenceNow)).toBeNull();
    expect(getClassroomAnnouncementExpirationLabel(localDateIso(-1, 23), referenceNow)).toBeNull();
  });

  it('never produces a negative result when expiration crosses a local date boundary', () => {
    const now = new Date(2026, 8, 30, 0, 15, 0, 0);
    const expiresAt = new Date(2026, 8, 29, 23, 59, 0, 0).toISOString();

    expect(getClassroomAnnouncementExpirationLabel(expiresAt, now)).toBeNull();
  });
});
