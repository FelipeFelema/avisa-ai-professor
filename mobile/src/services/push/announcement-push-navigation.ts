import { isAxiosError } from 'axios';
import { announcementKeys, queryClient } from '@/config';
import { getSessionGeneration, isSessionGenerationCurrent } from '@/lib/session-generation';
import { findOne } from '@/services/announcements/announcement.service';
import { parseAnnouncementPush, rememberAnnouncementTap } from './announcement-push-presentation';
import type { AnnouncementPushPayload } from '@/validations/announcement-push.schema';

type Status = 'idle' | 'waiting' | 'loading' | 'authorized' | 'error' | 'unavailable';
export interface AnnouncementPushState {
  status: Status;
  announcementId?: string;
  generation?: number;
}
type Intent = AnnouncementPushPayload & {
  generation: number;
  userId: string | null;
  expiresAt: number;
};
let state: AnnouncementPushState = { status: 'idle' };
let intent: Intent | null = null;
let userId: string | null = null;
let generation = getSessionGeneration();
let navigate: ((path: `/announcements/${string}`) => void) | null = null;
let controller: AbortController | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
export const getAnnouncementPushState = () => state;
export function subscribeAnnouncementPush(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function publish(next: AnnouncementPushState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function cancelAnnouncementPush(): void {
  controller?.abort();
  controller = null;
  if (expiry) clearTimeout(expiry);
  expiry = null;
  // Remove content before releasing a mounted route's blocking gate.
  if (intent)
    queryClient.removeQueries({
      queryKey: announcementKeys.detail(intent.announcementId),
      exact: true,
    });
  intent = null;
  publish({ status: 'idle' });
}

export function bindAnnouncementPushSession(
  nextUser: string | null,
  nextGeneration: number,
  push: (path: `/announcements/${string}`) => void,
): void {
  if (
    intent &&
    ((intent.userId !== null && intent.userId !== nextUser) || intent.generation !== nextGeneration)
  )
    cancelAnnouncementPush();
  userId = nextUser;
  generation = nextGeneration;
  navigate = push;
  if (intent && intent.userId === null && nextUser && isSessionGenerationCurrent(nextGeneration)) {
    intent.userId = nextUser;
    void resolveIntent();
  }
}

export function consumeAnnouncementPush(data: unknown): boolean {
  const payload = parseAnnouncementPush(data);
  if (!payload || !rememberAnnouncementTap(payload.dispatchId)) return false;
  cancelAnnouncementPush();
  intent = {
    ...payload,
    userId,
    generation: getSessionGeneration(),
    expiresAt: Date.now() + 5 * 60_000,
  };
  expiry = setTimeout(cancelAnnouncementPush, 5 * 60_000);
  publish({
    status: userId ? 'loading' : 'waiting',
    announcementId: payload.announcementId,
    generation: intent.generation,
  });
  if (userId) void resolveIntent();
  return true;
}

export async function retryAnnouncementPush(): Promise<void> {
  if (state.status !== 'error') return;
  await resolveIntent();
}

async function resolveIntent(): Promise<void> {
  const captured = intent;
  if (!captured || !captured.userId || !navigate || controller || Date.now() >= captured.expiresAt)
    return;
  const current = () =>
    intent === captured &&
    userId === captured.userId &&
    generation === captured.generation &&
    isSessionGenerationCurrent(captured.generation) &&
    Date.now() < captured.expiresAt;
  if (!current()) {
    cancelAnnouncementPush();
    return;
  }
  const request = new AbortController();
  controller = request;
  publish({
    status: 'loading',
    announcementId: captured.announcementId,
    generation: captured.generation,
  });
  try {
    const key = announcementKeys.detail(captured.announcementId);
    await queryClient.cancelQueries({ queryKey: key, exact: true });
    if (!current()) return;
    queryClient.removeQueries({ queryKey: key, exact: true });
    // Direct service request bypasses cached query results and automatic query retries.
    const announcement = await findOne(captured.announcementId, {
      sessionGeneration: captured.generation,
      signal: request.signal,
    });
    if (!current() || request.signal.aborted) return;
    if (
      announcement.id !== captured.announcementId ||
      new Date(announcement.expiresAt).getTime() <= Date.now()
    ) {
      publish({
        status: 'unavailable',
        announcementId: captured.announcementId,
        generation: captured.generation,
      });
      return;
    }
    queryClient.setQueryData(key, announcement);
    publish({
      status: 'authorized',
      announcementId: captured.announcementId,
      generation: captured.generation,
    });
    navigate(`/announcements/${captured.announcementId}`);
  } catch (error) {
    if (!current() || request.signal.aborted) return;
    queryClient.removeQueries({
      queryKey: announcementKeys.detail(captured.announcementId),
      exact: true,
    });
    publish({
      status: isAxiosError(error) && error.response?.status === 404 ? 'unavailable' : 'error',
      announcementId: captured.announcementId,
      generation: captured.generation,
    });
  } finally {
    if (controller === request) controller = null;
  }
}
