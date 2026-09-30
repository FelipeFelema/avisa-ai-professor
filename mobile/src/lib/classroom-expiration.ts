const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getClassroomAnnouncementExpirationLabel(
  expiresAt?: string | null,
  now: Date = new Date(),
): string | null {
  if (!expiresAt || Number.isNaN(now.getTime())) {
    return null;
  }

  const expiration = new Date(expiresAt);
  if (Number.isNaN(expiration.getTime()) || expiration.getTime() < now.getTime()) {
    return null;
  }

  const expirationCalendar = Date.UTC(
    expiration.getFullYear(),
    expiration.getMonth(),
    expiration.getDate(),
  );
  const currentCalendar = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const calendarDifference = Math.round(
    (expirationCalendar - currentCalendar) / MILLISECONDS_PER_DAY,
  );

  if (calendarDifference < 0) {
    return null;
  }

  if (calendarDifference === 0) {
    return 'Expira hoje';
  }

  if (calendarDifference === 1) {
    return 'Expira em 1 dia';
  }

  return `Expira em ${calendarDifference} dias`;
}
