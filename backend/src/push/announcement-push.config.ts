import { registerAs } from '@nestjs/config';
import { createPushConfig } from './push.config';

export function createAnnouncementPushConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const enabled =
    env.ANNOUNCEMENT_PUSH_ENABLED === 'true' && createPushConfig(env).enabled;
  return {
    enabled,
    remindersEnabled:
      enabled && env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED === 'true',
  };
}

export const announcementPushConfig = registerAs('announcementPush', () =>
  createAnnouncementPushConfig(),
);

export const ANNOUNCEMENT_REMINDER_LEAD_MS = 24 * 60 * 60_000;

export function isAnnouncementReminderDue(
  announcement: {
    createdAt: Date;
    expiresAt: Date | null;
    notificationPending: boolean | null;
  },
  now: Date,
): boolean {
  const expiry = announcement.expiresAt?.getTime();
  if (
    expiry === undefined ||
    !Number.isFinite(expiry) ||
    announcement.notificationPending === null
  )
    return false;
  const due = expiry - ANNOUNCEMENT_REMINDER_LEAD_MS;
  return (
    announcement.createdAt.getTime() <= due &&
    now.getTime() >= due &&
    now.getTime() < expiry
  );
}

export function announcementExpirationKey(expiresAt: Date): string {
  return 'expiration:' + expiresAt.getTime();
}
