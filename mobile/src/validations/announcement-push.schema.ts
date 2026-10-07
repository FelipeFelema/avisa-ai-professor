import { z } from 'zod';

export const announcementPushSchema = z.strictObject({
  version: z.literal(1),
  type: z.enum(['announcement-created', 'announcement-expiring']),
  announcementId: z.uuid({ version: 'v4' }),
  dispatchId: z.uuid({ version: 'v4' }),
});
export type AnnouncementPushPayload = z.infer<typeof announcementPushSchema>;
