import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { AuthContext } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { api } from '@/lib/api';
import { PushProvider } from '@/providers/PushProvider';
import { getPushRuntimeConfig } from '@/config/push-config';
import * as storage from '@/storage/push.storage';
import * as device from '@/services/push/push-device.service';
import { pushMocks } from '../helpers/push';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/config/push-config', () => ({ getPushRuntimeConfig: jest.fn() }));
jest.mock('@/storage', () => ({ getTokens: jest.fn(async () => null) }));
jest.mock('@/storage/push.storage', () => ({
  getOrCreatePushIdentity: jest.fn(),
  getPushOptIn: jest.fn(),
  readCurrentBinding: jest.fn(),
  readPendingRevocation: jest.fn(),
  saveCurrentBinding: jest.fn(),
}));
jest.mock('@/services/push/push-device.service', () => ({
  readPushPermission: jest.fn(),
  getExpoPushToken: jest.fn(),
}));

const auth = {
  user: {
    id: 'synthetic-user',
    name: 'Pessoa',
    email: 'pessoa@example.test',
    role: 'PARENT' as const,
  },
  isAuthenticated: true,
  isLoading: false,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
  applyProfileUpdate: () => undefined,
  expireSession: async () => undefined,
};

describe('push reconciliation with the real API interceptors and lifecycle', () => {
  it.each([10, 0])(
    'settles after one foreground transition with %s guard slots left',
    async (slots) => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      const start = Date.now();
      const previousAdapter = api.defaults.adapter;
      const trace: { atMs: number; method: string; path: string; status: number }[] = [];
      const statuses: string[] = [];
      let permission: device.PushPermissionState = 'NOT_REQUESTED';
      const binding = {
        bindingId: '00000000-0000-4000-8000-000000000112',
        lifecycleVersion: 1,
        tokenRevision: 0,
        state: 'RESERVED',
      };
      jest.mocked(getPushRuntimeConfig).mockReturnValue({
        available: true,
        platform: 'ANDROID',
        projectId: 'synthetic-project',
        reason: null,
      });
      jest.mocked(storage.getPushOptIn).mockResolvedValue(true);
      jest.mocked(storage.getOrCreatePushIdentity).mockResolvedValue({
        installationId: '00000000-0000-4000-8000-000000000111',
        capability: 'A'.repeat(43),
      });
      // A native storage read can finish after the HTTP operation that triggered its callback.
      jest
        .mocked(storage.readPendingRevocation)
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(null), 5)));
      jest.mocked(storage.readCurrentBinding).mockResolvedValue(null);
      jest.mocked(storage.saveCurrentBinding).mockResolvedValue(undefined);
      jest.mocked(device.readPushPermission).mockImplementation(async () => permission);
      jest
        .mocked(device.getExpoPushToken)
        .mockResolvedValue('ExpoPushToken[synthetic-feedback-token]');
      const addStateListener = jest.spyOn(AppState, 'addEventListener');

      // Controlled transport only: no network, real credential or database access.
      // Model the unchanged guard's shared 10-request / 60-second bucket.
      api.defaults.adapter = async (
        request: InternalAxiosRequestConfig,
      ): Promise<AxiosResponse> => {
        const method = (request.method ?? 'get').toUpperCase();
        const path = request.url ?? '';
        const allowed =
          trace.filter((entry) => entry.status !== 429 && Date.now() - start - entry.atMs < 60_000)
            .length < slots;
        const status = allowed ? 200 : 429;
        trace.push({ atMs: Date.now() - start, method, path, status });
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (!allowed) {
          throw new AxiosError('rate limited', undefined, request, undefined, {
            status,
            statusText: 'Too Many Requests',
            config: request,
            headers: {},
            data: {},
          });
        }
        if (method === 'PUT') {
          binding.state = 'ACTIVE';
          binding.tokenRevision += 1;
        }
        const data =
          method === 'GET'
            ? {
                available: true,
                state: binding.state,
                binding: { ...binding },
                reason: null,
                testAvailableAt: null,
              }
            : { ...binding };
        return { status, statusText: 'OK', config: request, headers: {}, data };
      };

      function Probe() {
        const push = usePushNotifications();
        if (statuses.at(-1) !== push.status) statuses.push(push.status);
        return null;
      }
      const view = await render(
        <AuthContext.Provider value={auth}>
          <PushProvider>
            <Probe />
          </PushProvider>
        </AuthContext.Provider>,
      );
      try {
        await act(async () => jest.advanceTimersByTimeAsync(30));
        expect(trace).toEqual([]);
        const onState = addStateListener.mock.calls[0]?.[1];
        expect(onState).toBeDefined();
        await act(async () => {
          onState?.('background');
          permission = 'GRANTED';
          onState?.('active');
          onState?.('active');
          await jest.advanceTimersByTimeAsync(200);
        });
        const counts = Object.fromEntries(
          [...new Set(trace.map((entry) => `${entry.method} ${entry.path} ${entry.status}`))].map(
            (key) => [
              key,
              trace.filter((entry) => `${entry.method} ${entry.path} ${entry.status}` === key)
                .length,
            ],
          ),
        );
        console.info(
          JSON.stringify({
            diagnostic: 'controlled-foreground-reproduction',
            windowMs: 200,
            slots,
            counts,
            statuses,
          }),
        );
        expect(trace.map(({ method, path, status }) => ({ method, path, status }))).toEqual(
          slots > 0
            ? [
                { method: 'POST', path: '/push/installation/reserve', status: 200 },
                { method: 'PUT', path: '/push/installation', status: 200 },
              ]
            : [{ method: 'POST', path: '/push/installation/reserve', status: 429 }],
        );
        expect(statuses.at(-1)).toBe(slots > 0 ? 'ACTIVE' : 'ERROR');
        expect(pushMocks.notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      } finally {
        permission = 'NOT_REQUESTED';
        await view.unmount();
        await act(async () => jest.advanceTimersByTimeAsync(30));
        api.defaults.adapter = previousAdapter;
        jest.restoreAllMocks();
        jest.useRealTimers();
      }
    },
  );
});
