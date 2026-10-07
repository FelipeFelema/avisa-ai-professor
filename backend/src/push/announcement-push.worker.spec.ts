import { AnnouncementPushWorker } from './announcement-push.worker';
import { AnnouncementPushService } from './announcement-push.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushAdapter } from './expo-push.adapter';

describe('announcement worker boundaries', () => {
  const env = {
    EXPO_PUSH_ENABLED: 'true',
    EXPO_PUSH_ACCESS_TOKEN: 'synthetic-test-only',
    ANNOUNCEMENT_PUSH_ENABLED: 'true',
  };
  let previous: NodeJS.ProcessEnv;
  beforeEach(() => {
    previous = { ...process.env };
    Object.assign(process.env, env);
  });
  afterEach(() => {
    process.env = previous;
    jest.restoreAllMocks();
  });
  function setup() {
    const service = {
      expire: jest.fn().mockResolvedValue(undefined),
      materialize: jest.fn().mockResolvedValue(undefined),
      claim: jest.fn().mockResolvedValue([]),
      authorize: jest.fn(),
      completeSend: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      announcement: {
        findMany: jest.fn().mockResolvedValue([{ id: 'saved' }]),
      },
    };
    const expo = {
      sendAnnouncement: jest
        .fn()
        .mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic-ticket' }),
    };
    const worker = new AnnouncementPushWorker(
      prisma as unknown as PrismaService,
      service as unknown as AnnouncementPushService,
      expo as unknown as ExpoPushAdapter,
    );
    return { worker, service, prisma, expo };
  }
  it('does not query or send when the business switch is off', async () => {
    process.env.ANNOUNCEMENT_PUSH_ENABLED = 'false';
    const s = setup();
    await s.worker.tick();
    expect(s.prisma.announcement.findMany).not.toHaveBeenCalled();
    expect(s.expo.sendAnnouncement).not.toHaveBeenCalled();
  });
  it('reconciles at startup and every 30 seconds with bounded pending selection and a single timer', async () => {
    jest.useFakeTimers();
    const s = setup();
    try {
      s.worker.onModuleInit();
      await s.worker.tick();
      expect(s.prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
      expect(jest.getTimerCount()).toBe(1);
      await jest.advanceTimersByTimeAsync(30000);
      expect(s.prisma.announcement.findMany).toHaveBeenCalledTimes(2);
      await s.worker.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it('recovers each pending publication and uses only the authorized snapshot outside its transaction', async () => {
    const s = setup();
    s.service.claim.mockResolvedValue([{ id: 'dispatch' }]);
    const snapshot = {
      id: 'dispatch',
      announcementId: 'announcement',
      classroomName: 'Current classroom',
      announcementTitle: 'Current title',
      expoToken: 'synthetic',
      ttl: 30,
      type: 'announcement-created',
      claimVersion: 1,
    };
    s.service.authorize.mockResolvedValue(snapshot);
    await s.worker.tick();
    expect(s.service.materialize).toHaveBeenCalledWith(
      'saved',
      expect.any(Date),
    );
    expect(s.expo.sendAnnouncement).toHaveBeenCalledWith(
      'synthetic',
      {
        announcementId: 'announcement',
        classroomName: 'Current classroom',
        announcementTitle: 'Current title',
        dispatchId: 'dispatch',
        ttl: 30,
        type: 'announcement-created',
      },
      expect.any(AbortSignal),
    );
    expect(s.service.completeSend).toHaveBeenCalledWith(
      snapshot,
      { kind: 'accepted', ticketId: 'synthetic-ticket' },
      expect.any(Date),
    );
  });
  it('persists ambiguity without returning the dispatch to the send queue', async () => {
    const s = setup();
    s.service.claim.mockResolvedValue([{ id: 'dispatch' }]);
    s.service.authorize.mockResolvedValue({
      id: 'dispatch',
      expoToken: 'synthetic',
      announcementId: 'announcement',
      ttl: 30,
      claimVersion: 1,
    });
    s.expo.sendAnnouncement.mockRejectedValue(new Error('synthetic timeout'));
    await s.worker.tick();
    expect(s.expo.sendAnnouncement).toHaveBeenCalledTimes(1);
    expect(s.service.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dispatch' }),
      null,
      expect.any(Date),
    );
  });
  it('does not send suppressed or unauthorized dispatches', async () => {
    const s = setup();
    s.service.claim.mockResolvedValue([{ id: 'dispatch' }]);
    s.service.authorize.mockResolvedValue(null);
    await s.worker.tick();
    expect(s.expo.sendAnnouncement).not.toHaveBeenCalled();
  });
  it('limits simultaneous provider requests to two and drains on shutdown', async () => {
    const s = setup();
    s.service.claim.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    s.service.authorize.mockImplementation((r: { id: string }) =>
      Promise.resolve({
        ...r,
        announcementId: 'announcement',
        expoToken: 'synthetic',
        ttl: 30,
        claimVersion: 1,
      }),
    );
    let active = 0,
      max = 0;
    s.expo.sendAnnouncement.mockImplementation(
      async (_token: string, _intent: unknown, signal: AbortSignal) => {
        active++;
        max = Math.max(max, active);
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
        active--;
        return { kind: 'accepted', ticketId: 'synthetic' };
      },
    );
    const tick = s.worker.tick();
    for (let i = 0; i < 20 && active < 2; i++)
      await new Promise((resolve) => setTimeout(resolve, 1));
    expect(active).toBe(2);
    await s.worker.onModuleDestroy();
    await tick;
    expect(max).toBe(2);
    expect(s.expo.sendAnnouncement).toHaveBeenCalledTimes(2);
  });
});
