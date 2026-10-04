export type SessionNotice = 'account-deleted' | 'session-ended';

let pendingNotice: SessionNotice | undefined;

export function setSessionNotice(notice: SessionNotice): void {
  pendingNotice = notice;
}

export function consumeSessionNotice(): SessionNotice | undefined {
  const notice = pendingNotice;
  pendingNotice = undefined;
  return notice;
}
