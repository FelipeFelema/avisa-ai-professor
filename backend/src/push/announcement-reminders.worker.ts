import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementPushService } from './announcement-push.service';
import { createAnnouncementPushConfig } from './announcement-push.config';

@Injectable()
export class AnnouncementRemindersWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private shuttingDown = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: AnnouncementPushService,
  ) {}
  onModuleInit(): void {
    if (!createAnnouncementPushConfig().remindersEnabled) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 60_000);
    this.timer.unref?.();
    void this.tick().catch(() => undefined);
  }
  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.running?.catch(() => undefined);
  }
  async tick(now = new Date()): Promise<void> {
    if (this.shuttingDown || !createAnnouncementPushConfig().remindersEnabled)
      return;
    if (this.running) return this.running;
    this.running = this.runTick(now);
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
  private async runTick(now: Date): Promise<void> {
    // Exclude completed occurrences before LIMIT, so older events cannot starve new work.
    const candidates = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT a."id" FROM "Announcement" a
      WHERE a."notificationPending" IS NOT NULL
        AND a."expiresAt" > ${now}::timestamp
        AND a."expiresAt" <= ${now}::timestamp + INTERVAL '24 hours'
        AND a."createdAt" <= a."expiresAt" - INTERVAL '24 hours'
        AND NOT EXISTS (SELECT 1 FROM "AnnouncementPushEvent" e
          WHERE e."announcementId" = a."id" AND e."kind" = 'EXPIRING'
            AND e."occurrenceKey" = 'expiration:' || (EXTRACT(EPOCH FROM a."expiresAt") * 1000)::bigint::text)
      ORDER BY a."expiresAt", a."id" LIMIT 20
    `;
    for (const candidate of candidates) {
      if (this.shuttingDown || !createAnnouncementPushConfig().remindersEnabled)
        return;
      try {
        await this.service.materializeReminder(candidate.id, now);
      } catch {
        /* retry pre-send fanout on next tick */
      }
    }
  }
}
