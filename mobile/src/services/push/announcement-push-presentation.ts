import { announcementPushSchema } from '@/validations/announcement-push.schema';
import type { AnnouncementPushPayload } from '@/validations/announcement-push.schema';

const received = new Set<string>();
const tapped = new Set<string>();
function remember(history: Set<string>, id: string): boolean {
  if (history.has(id)) return false;
  history.add(id);
  if (history.size > 128) history.delete(history.values().next().value!);
  return true;
}
export function parseAnnouncementPush(data: unknown): AnnouncementPushPayload | null {
  const result = announcementPushSchema.safeParse(data);
  return result.success ? result.data : null;
}
export const rememberAnnouncementReceipt = (id: string) => remember(received, id);
export const rememberAnnouncementTap = (id: string) => remember(tapped, id);
export function resetAnnouncementPushDedupe(): void {
  received.clear();
  tapped.clear();
}
