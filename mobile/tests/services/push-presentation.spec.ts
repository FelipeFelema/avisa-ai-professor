import {
  handlePushTestNotification,
  isPushTestNotification,
  parsePushTestAttemptId,
  rememberPushTestAttempt,
  subscribePushTestPresentation,
} from '@/services/push/push-presentation';

const attemptId = '00000000-0000-4000-8000-000000000711';

describe('push test presentation', () => {
  it('accepts only the neutral push-test payload and a valid opaque attempt id', () => {
    expect(parsePushTestAttemptId({ type: 'push-test', attemptId })).toBe(attemptId);
    expect(isPushTestNotification({ type: 'push-test', attemptId })).toBe(true);
    expect(parsePushTestAttemptId({ type: 'announcement', attemptId })).toBeNull();
    expect(parsePushTestAttemptId({ type: 'push-test', attemptId: 'private-token' })).toBeNull();
    expect(isPushTestNotification({ type: 'push-test', attemptId: 'private-token' })).toBe(false);
  });

  it('updates only a known attempt and deduplicates foreground and response listeners', () => {
    const stopRemembering = rememberPushTestAttempt(attemptId);
    const listener = jest.fn();
    const stopListening = subscribePushTestPresentation(listener);
    const payload = { type: 'push-test', attemptId };

    expect(handlePushTestNotification(payload)).toBe(true);
    expect(handlePushTestNotification(payload)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(attemptId);

    stopListening();
    stopRemembering();
  });

  it('does not create feedback for an unrecognized attempt id', () => {
    const listener = jest.fn();
    const stopListening = subscribePushTestPresentation(listener);

    expect(handlePushTestNotification({ type: 'push-test', attemptId })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    stopListening();
  });
});
