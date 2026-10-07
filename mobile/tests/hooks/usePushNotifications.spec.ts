import { act, renderHook, waitFor } from '@testing-library/react-native';
import { pushMocks } from '../helpers/push';
import * as pushLifecycle from '@/services/push/push-lifecycle';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getSessionGeneration } from '@/lib/session-generation';

jest.mock('@/services/push/push-lifecycle', () => ({
  getPushLifecycleSnapshot: jest.fn(),
  reconcilePushNotifications: jest.fn(),
  subscribePushLifecycle: jest.fn(),
  enablePushNotifications: jest.fn(),
  disablePushNotifications: jest.fn(),
}));

const lifecycle = jest.mocked(pushLifecycle);
const notRequested = { status: 'NOT_REQUESTED' as const, message: null };

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lifecycle.subscribePushLifecycle.mockReturnValue(jest.fn());
    lifecycle.reconcilePushNotifications.mockResolvedValue({
      status: 'AUTHORIZED_APP_DISABLED',
      message: null,
    });
    lifecycle.getPushLifecycleSnapshot.mockResolvedValue(notRequested);
    lifecycle.enablePushNotifications.mockResolvedValue({ status: 'ACTIVE', message: null });
    lifecycle.disablePushNotifications.mockResolvedValue({
      status: 'NOT_REQUESTED',
      message: null,
    });
  });

  it('restores status without prompting or activating when the hook mounts', async () => {
    const { result } = await renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.status).toBe('NOT_REQUESTED'));
    expect(lifecycle.getPushLifecycleSnapshot).toHaveBeenCalledTimes(1);
    expect(lifecycle.enablePushNotifications).not.toHaveBeenCalled();
    expect(pushMocks.notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('starts activation only after an explicit user action', async () => {
    const { result } = await renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe('NOT_REQUESTED'));

    await act(async () => result.current.activate());

    expect(lifecycle.enablePushNotifications).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ACTIVE');
  });

  it('keeps an activation single-flight when a user presses twice', async () => {
    let resolve!: (value: { status: 'ACTIVE'; message: null }) => void;
    lifecycle.enablePushNotifications.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = await renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe('NOT_REQUESTED'));

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.activate();
    });
    await act(async () => {
      second = result.current.activate();
    });
    expect(lifecycle.enablePushNotifications).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ status: 'ACTIVE', message: null });
      await Promise.all([first, second]);
    });
    expect(result.current.status).toBe('ACTIVE');
  });

  it.each([
    'DENIED',
    'UNAVAILABLE',
    'PENDING_CLEANUP',
    'RECOVERY',
    'AUTHORIZED_APP_DISABLED',
  ] as const)('exposes %s as a distinct state with safe feedback', async (status) => {
    lifecycle.getPushLifecycleSnapshot.mockResolvedValueOnce({
      status,
      message: `safe-${status}`,
    });
    const { result, unmount } = await renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe(status));
    expect(result.current.message).toBe(`safe-${status}`);
    unmount();
  });

  it('refreshes a pending cleanup without prompting and observes lifecycle completion', async () => {
    let publish!: (result: { status: 'ACTIVE'; message: null }, sessionGeneration: number) => void;
    const remove = jest.fn();
    lifecycle.getPushLifecycleSnapshot.mockResolvedValueOnce({
      status: 'PENDING_CLEANUP',
      message: 'cleanup pending',
    });
    lifecycle.reconcilePushNotifications.mockResolvedValueOnce({
      status: 'AUTHORIZED_APP_DISABLED',
      message: null,
    });
    lifecycle.subscribePushLifecycle.mockImplementation((listener) => {
      publish = listener;
      return remove;
    });
    const { result, unmount } = await renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.status).toBe('PENDING_CLEANUP'));

    await act(async () => result.current.refresh());
    expect(lifecycle.reconcilePushNotifications).toHaveBeenCalledWith(expect.any(Number));
    expect(result.current.status).toBe('AUTHORIZED_APP_DISABLED');
    expect(pushMocks.notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    await act(async () => {
      publish({ status: 'ACTIVE', message: null }, getSessionGeneration());
    });
    expect(result.current.status).toBe('ACTIVE');
    unmount();
  });
});
