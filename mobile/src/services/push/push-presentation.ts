const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REMEMBERED_ATTEMPTS = 128;

const knownAttempts = new Set<string>();
const presentedAttempts = new Set<string>();
const listeners = new Set<(attemptId: string) => void>();

export function parsePushTestAttemptId(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (
    record.type !== 'push-test' ||
    typeof record.attemptId !== 'string' ||
    !uuidV4Pattern.test(record.attemptId)
  ) {
    return null;
  }
  return record.attemptId;
}

export function isPushTestNotification(data: unknown): boolean {
  return parsePushTestAttemptId(data) !== null;
}

export function rememberPushTestAttempt(attemptId: string): () => void {
  if (!uuidV4Pattern.test(attemptId)) return () => undefined;
  knownAttempts.add(attemptId);
  while (knownAttempts.size > MAX_REMEMBERED_ATTEMPTS) {
    const oldest = knownAttempts.values().next().value as string | undefined;
    if (!oldest) break;
    knownAttempts.delete(oldest);
    presentedAttempts.delete(oldest);
  }
  return () => {
    knownAttempts.delete(attemptId);
    presentedAttempts.delete(attemptId);
  };
}

export function subscribePushTestPresentation(listener: (attemptId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function handlePushTestNotification(data: unknown): boolean {
  const attemptId = parsePushTestAttemptId(data);
  if (!attemptId || !knownAttempts.has(attemptId) || presentedAttempts.has(attemptId)) {
    return false;
  }
  presentedAttempts.add(attemptId);
  for (const listener of listeners) {
    try {
      listener(attemptId);
    } catch {
      // Presentation observers cannot interrupt native notification handling.
    }
  }
  return true;
}
