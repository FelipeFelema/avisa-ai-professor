import { AnnouncementRemindersWorker } from './announcement-reminders.worker';
import { isAnnouncementReminderDue } from './announcement-push.config';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementPushService } from './announcement-push.service';

const now = new Date('2026-10-07T12:00:00Z');
const day = 86400_000;
describe('expiration reminder selection', () => {
  let previous: NodeJS.ProcessEnv;
  beforeEach(() => {
    previous = { ...process.env };
    Object.assign(process.env, {
      EXPO_PUSH_ENABLED: 'true',
      EXPO_PUSH_ACCESS_TOKEN: 'synthetic',
      ANNOUNCEMENT_PUSH_ENABLED: 'true',
      ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
    });
  });
  afterEach(() => {
    process.env = previous;
    jest.useRealTimers();
  });
  function setup() {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'due' }]) };
    const service = {
      materializeReminder: jest.fn().mockResolvedValue(undefined),
    };
    const worker = new AnnouncementRemindersWorker(
      prisma as unknown as PrismaService,
      service as unknown as AnnouncementPushService,
    );
    return { prisma, service, worker };
  }
  it.each([
    ['due', -day, day, false, true],
    ['early', -day, day + 1, false, false],
    ['late active', -day, 1, false, true],
    ['expired', -day, 0, false, false],
    ['short lived', 0, day - 1, false, false],
    ['legacy', -day, day, null, false],
    ['no expiry', -day, null, false, false],
  ] as const)(
    '%s uses only the current expiry',
    (_name, createdOffset, expiryOffset, marker, expected) => {
      expect(
        isAnnouncementReminderDue(
          {
            createdAt: new Date(now.getTime() + createdOffset),
            expiresAt:
              expiryOffset === null
                ? null
                : new Date(now.getTime() + expiryOffset),
            notificationPending: marker,
          },
          now,
        ),
      ).toBe(expected);
    },
  );
  it('recalculates due time on edit and rejects invalid expiry', () => {
    const a = {
      createdAt: new Date(now.getTime() - day),
      expiresAt: new Date(now.getTime() + day),
      notificationPending: false,
    };
    expect(isAnnouncementReminderDue(a, now)).toBe(true);
    a.expiresAt = new Date(now.getTime() + 2 * day);
    expect(isAnnouncementReminderDue(a, now)).toBe(false);
    a.expiresAt = new Date(NaN);
    expect(isAnnouncementReminderDue(a, now)).toBe(false);
  });
  it.each([
    'ANNOUNCEMENT_PUSH_REMINDERS_ENABLED',
    'ANNOUNCEMENT_PUSH_ENABLED',
    'EXPO_PUSH_ENABLED',
  ])('does no work when %s is false', async (flag) => {
    process.env[flag] = 'false';
    const s = setup();
    s.worker.onModuleInit();
    await s.worker.tick(now);
    expect(s.prisma.$queryRaw).not.toHaveBeenCalled();
    await s.worker.onModuleDestroy();
  });
  it('starts immediately and selects every 60 seconds, draining on shutdown', async () => {
    jest.useFakeTimers();
    const s = setup();
    s.worker.onModuleInit();
    await s.worker.tick();
    expect(s.service.materializeReminder).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(60000);
    expect(s.service.materializeReminder).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(1);
    await s.worker.onModuleDestroy();
    await s.worker.tick();
    expect(jest.getTimerCount()).toBe(0);
    expect(s.prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('keeps one local tick in flight and continues after one fanout failure', async () => {
    const s = setup();
    s.prisma.$queryRaw.mockResolvedValue([{ id: 'failed' }, { id: 'ok' }]);
    let release!: () => void;
    s.service.materializeReminder
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('synthetic'));
    const first = s.worker.tick(now);
    const second = s.worker.tick(now);
    await Promise.resolve();
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(s.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(s.service.materializeReminder).toHaveBeenCalledTimes(2);
    await s.worker.onModuleDestroy();
  });
});
