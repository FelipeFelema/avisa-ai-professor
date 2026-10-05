import { AxiosError, AxiosHeaders } from 'axios';
import { api } from '@/lib';
import { getSessionGeneration } from '@/lib/session-generation';
import {
  createTeacherInvite,
  TeacherInviteError,
  getTeacherInviteFeedback,
} from '@/services/admin/teacher-invite.service';

jest.mock('@/lib', () => ({ api: { post: jest.fn() } }));

const result = {
  id: 'e6a84760-64a8-4fe8-ae23-3a4e5b833c17',
  code: `PROF-${'A'.repeat(32)}`,
  role: 'PROFESSOR',
  isActive: true,
  createdAt: '2026-10-04T12:00:00.000Z',
  expiresAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
} as const;

describe('teacher invite service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('sends one fixed no-replay request and returns validated data', async () => {
    const controller = new AbortController();
    const generation = getSessionGeneration();
    jest.mocked(api.post).mockResolvedValue({ data: result });
    await expect(
      createTeacherInvite({ signal: controller.signal, sessionGeneration: generation }),
    ).resolves.toEqual(result);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/invite-codes',
      { role: 'PROFESSOR' },
      {
        signal: controller.signal,
        sessionGeneration: generation,
        noAuthReplay: true,
      },
    );
  });

  it.each([400, 401, 403, 500, 503, undefined])(
    'maps status %s without retaining raw error data',
    async (status) => {
      const sentinel = 'SYNTHETIC_INVITE_SENTINEL';
      const config = { headers: new AxiosHeaders(), data: { role: 'PROFESSOR', secret: sentinel } };
      const error = new AxiosError(
        sentinel,
        undefined,
        config,
        { secret: sentinel },
        status
          ? {
              status,
              statusText: 'Failure',
              config,
              headers: {},
              data: { message: sentinel },
            }
          : undefined,
      );
      jest.mocked(api.post).mockRejectedValue(error);
      let caught: unknown;
      try {
        await createTeacherInvite({ sessionGeneration: getSessionGeneration() });
      } catch (value) {
        caught = value;
      }
      expect(caught).toBeInstanceOf(TeacherInviteError);
      expect(JSON.stringify(caught)).not.toContain(sentinel);
      expect(
        ['config', 'request', 'response', 'cause'].some((key) => key in (caught as object)),
      ).toBe(false);
      expect(getTeacherInviteFeedback(caught).message).not.toContain(sentinel);
    },
  );

  it('does not echo a caller-supplied error message through the feedback mapper', () => {
    const sentinel = 'SYNTHETIC_INVITE_SENTINEL';
    const error = new TeacherInviteError({
      category: 'unavailable',
      message: sentinel,
    });
    expect(getTeacherInviteFeedback(error).message).not.toContain(sentinel);
  });

  it.each(['cancel', 'timeout', 'server', 'malformed'] as const)(
    'treats %s as uncertain and never retries',
    async (failure) => {
      if (failure === 'malformed')
        jest.mocked(api.post).mockResolvedValue({ data: { ...result, secret: 'SYNTHETIC' } });
      else
        jest.mocked(api.post).mockRejectedValue(
          failure === 'cancel'
            ? new AxiosError('SYNTHETIC', 'ERR_CANCELED')
            : failure === 'timeout'
              ? new AxiosError('SYNTHETIC', 'ECONNABORTED')
              : new AxiosError('SYNTHETIC', undefined, undefined, undefined, {
                  status: 503,
                  statusText: 'Error',
                  config: { headers: new AxiosHeaders() },
                  headers: {},
                  data: {},
                }),
        );
      let caught: unknown;
      try {
        await createTeacherInvite({ sessionGeneration: getSessionGeneration() });
      } catch (value) {
        caught = value;
      }
      expect(caught).toMatchObject({ uncertain: true });
      expect(JSON.stringify(caught)).not.toContain('SYNTHETIC');
      expect(api.post).toHaveBeenCalledTimes(1);
    },
  );
});
