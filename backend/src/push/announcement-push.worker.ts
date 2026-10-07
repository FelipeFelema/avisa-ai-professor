import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnnouncementPushService,
  type ClaimedAnnouncementDispatch,
} from './announcement-push.service';
import { createAnnouncementPushConfig } from './announcement-push.config';
import { ExpoPushAdapter, type ExpoSendResult } from './expo-push.adapter';

@Injectable()
export class AnnouncementPushWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private shuttingDown = false;
  private readonly requests = new Set<AbortController>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: AnnouncementPushService,
    private readonly expo: ExpoPushAdapter,
  ) {}
  onModuleInit(): void {
    if (!createAnnouncementPushConfig().enabled) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 30_000);
    this.timer.unref?.();
    void this.tick().catch(() => undefined);
  }
  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const controller of this.requests) controller.abort();
    await this.running?.catch(() => undefined);
  }
  async tick(now = new Date()): Promise<void> {
    if (this.shuttingDown || !createAnnouncementPushConfig().enabled) return;
    if (this.running) return this.running;
    this.running = this.runTick(now);
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
  private async runTick(now: Date): Promise<void> {
    await this.service.expire(now);
    const pending = await this.prisma.announcement.findMany({
      where: { notificationPending: true },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    for (const announcement of pending) {
      if (this.shuttingDown) return;
      // A failed materialization remains pending; other publications must still progress.
      try {
        await this.service.materialize(announcement.id, now);
      } catch {
        /* next tick */
      }
    }
    const claimed = await this.service.claim(now);
    for (
      let offset = 0;
      offset < claimed.length && !this.shuttingDown;
      offset += 2
    ) {
      const outcomes = await Promise.allSettled(
        claimed.slice(offset, offset + 2).map((row) => this.send(row)),
      );
      // Drain both in-flight transactions/requests even when one persistence write fails.
      if (outcomes.some((result) => result.status === 'rejected'))
        throw new Error('ANNOUNCEMENT_PUSH_DISPATCH_FAILED');
    }
  }
  private async send(row: ClaimedAnnouncementDispatch): Promise<void> {
    if (
      this.shuttingDown ||
      !createAnnouncementPushConfig().enabled ||
      (row.event?.kind === 'EXPIRING' &&
        !createAnnouncementPushConfig().remindersEnabled)
    )
      return;
    const snapshot = await this.service.authorize(row);
    if (!snapshot) return;
    // SENDING has committed. From here even shutdown/ambiguous outcomes must never requeue.
    const controller = new AbortController();
    this.requests.add(controller);
    if (this.shuttingDown) controller.abort();
    let outcome: ExpoSendResult | null = null;
    try {
      if (!controller.signal.aborted)
        outcome = await this.expo.sendAnnouncement(
          snapshot.expoToken,
          {
            announcementId: snapshot.announcementId,
            dispatchId: snapshot.id,
            ttl: snapshot.ttl,
            type: snapshot.type,
          },
          controller.signal,
        );
    } catch {
      /* ambiguous provider outcome */
    } finally {
      this.requests.delete(controller);
    }
    // Persistence failures leave SENDING for expiry to UNKNOWN, never retry the HTTP request.
    await this.service.completeSend(snapshot, outcome, new Date());
  }
}
