import { Injectable } from '@nestjs/common';
import type {
  AnnouncementPushDispatch,
  AnnouncementPushKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PushRegistrationService,
  isPushRegistrationEligible,
} from './push-registration.service';
import type { ExpoReceiptResult, ExpoSendResult } from './expo-push.adapter';

import {
  announcementExpirationKey,
  createAnnouncementPushConfig,
  isAnnouncementReminderDue,
} from './announcement-push.config';

const bindingInclude = {
  installation: true,
  session: {
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  },
  user: { select: { id: true } },
} as const;
const dispatchInclude = { event: { include: { announcement: true } } } as const;
export type ClaimedAnnouncementDispatch =
  Prisma.AnnouncementPushDispatchGetPayload<{
    include: typeof dispatchInclude;
  }>;
export interface AnnouncementSendSnapshot {
  id: string;
  announcementId: string;
  expoToken: string;
  ttl: number;
  type: 'announcement-created' | 'announcement-expiring';
  claimVersion: number;
}
export type ClaimedAnnouncementReceipt = ClaimedAnnouncementDispatch & {
  claimedReceiptLease: Date;
};

@Injectable()
export class AnnouncementPushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: PushRegistrationService,
  ) {}

  async materialize(announcementId: string, now = new Date()): Promise<void> {
    return this.materializeEvent(announcementId, 'NEW', now);
  }

  async materializeReminder(
    announcementId: string,
    now = new Date(),
  ): Promise<void> {
    if (!createAnnouncementPushConfig().remindersEnabled) return;
    return this.materializeEvent(announcementId, 'EXPIRING', now);
  }

  private async materializeEvent(
    announcementId: string,
    kind: AnnouncementPushKind,
    now: Date,
  ): Promise<void> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (
      !announcement ||
      (kind === 'NEW'
        ? !announcement.notificationPending
        : !isAnnouncementReminderDue(announcement, now))
    )
      return;
    // Freeze identities before acquiring parents. Never discover new users after classroom locks.
    const candidates = (
      await this.prisma.pushRegistration.findMany({
        where: {
          state: 'ACTIVE',
          userId: { not: announcement.authorId },
          user: {
            userClassrooms: { some: { classroomId: announcement.classroomId } },
          },
        },
        include: bindingInclude,
      })
    ).filter((registration) =>
      isPushRegistrationEligible({
        registration,
        installation: registration.installation,
        session: registration.session,
        user: registration.user,
        now,
      }),
    );
    await this.registrations.withAnnouncementLocks(
      {
        userIds: candidates.map((r) => r.userId),
        classroomId: announcement.classroomId,
        sessionIds: candidates.map((r) => r.sessionId),
        installationIds: candidates.map((r) => r.installationId),
      },
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${announcementId} FOR UPDATE`;
        const current = await tx.announcement.findUnique({
          where: { id: announcementId },
        });
        if (
          !current ||
          (kind === 'NEW'
            ? !current.notificationPending
            : !isAnnouncementReminderDue(current, now))
        )
          return;
        if (
          !current.expiresAt ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          await tx.announcement.update({
            where: { id: announcementId },
            data: { notificationPending: false },
          });
          return;
        }
        const occurrenceKey =
          kind === 'NEW'
            ? 'publication'
            : announcementExpirationKey(current.expiresAt);
        const prior = await tx.announcementPushEvent.findUnique({
          where: {
            announcementId_kind_occurrenceKey: {
              announcementId,
              kind,
              occurrenceKey,
            },
          },
        });
        if (!prior) {
          const eligible: typeof candidates = [];
          for (const candidate of candidates) {
            await this.lockMembership(
              tx,
              candidate.userId,
              current.classroomId,
            );
            const member = await tx.userClassroom.findUnique({
              where: {
                userId_classroomId: {
                  userId: candidate.userId,
                  classroomId: current.classroomId,
                },
              },
            });
            const binding = await tx.pushRegistration.findUnique({
              where: { id: candidate.id },
              include: bindingInclude,
            });
            if (
              member &&
              binding &&
              this.sameBinding(candidate, binding) &&
              candidate.userId !== current.authorId &&
              isPushRegistrationEligible({
                registration: binding,
                installation: binding.installation,
                session: binding.session,
                user: binding.user,
                now,
              })
            )
              eligible.push(binding);
          }
          const event = await tx.announcementPushEvent.create({
            data: { announcementId, kind, occurrenceKey, snapshotAt: now },
          });
          await tx.announcementPushDispatch.createMany({
            data: eligible.map((binding) => ({
              eventId: event.id,
              installationId: binding.installationId,
              registrationId: binding.id,
              userId: binding.userId,
              sessionId: binding.sessionId,
              lifecycleVersion: binding.lifecycleVersion,
              tokenRevision: binding.tokenRevision,
              tokenFingerprint: binding.tokenFingerprint!,
            })),
          });
        }
        if (kind === 'NEW')
          await tx.announcement.update({
            where: { id: announcementId },
            data: { notificationPending: false },
          });
      },
    );
  }

  async claim(now = new Date()): Promise<ClaimedAnnouncementDispatch[]> {
    const candidates = await this.prisma.announcementPushDispatch.findMany({
      where: {
        ...(createAnnouncementPushConfig().remindersEnabled
          ? {}
          : { event: { kind: 'NEW' as const } }),
        OR: [
          { state: 'PENDING' },
          { state: 'CLAIMED', leaseUntil: { lte: now } },
        ],
      },
      include: dispatchInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const claimed: ClaimedAnnouncementDispatch[] = [];
    for (const row of candidates) {
      const leaseUntil = new Date(now.getTime() + 60_000);
      const won = await this.prisma.announcementPushDispatch.updateMany({
        where: {
          id: row.id,
          state: row.state,
          claimVersion: row.claimVersion,
          leaseUntil: row.leaseUntil,
        },
        data: { state: 'CLAIMED', claimVersion: { increment: 1 }, leaseUntil },
      });
      if (won.count)
        claimed.push({
          ...row,
          state: 'CLAIMED',
          claimVersion: row.claimVersion + 1,
          leaseUntil,
        });
    }
    return claimed;
  }

  async authorize(
    row: ClaimedAnnouncementDispatch,
    now = new Date(),
  ): Promise<AnnouncementSendSnapshot | null> {
    return this.withDispatchLocks(row, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${row.event.announcementId} FOR SHARE`;
      await this.lockMembership(
        tx,
        row.userId,
        row.event.announcement.classroomId,
      );
      await tx.$queryRaw`SELECT "id" FROM "AnnouncementPushDispatch" WHERE "id" = ${row.id}::uuid FOR UPDATE`;
      const current = await tx.announcementPushDispatch.findUnique({
        where: { id: row.id },
      });
      if (
        !current ||
        current.state !== 'CLAIMED' ||
        current.claimVersion !== row.claimVersion ||
        !current.leaseUntil ||
        current.leaseUntil.getTime() <= now.getTime()
      )
        return null;
      const announcement = await tx.announcement.findUnique({
        where: { id: row.event.announcementId },
      });
      const member = await tx.userClassroom.findUnique({
        where: {
          userId_classroomId: {
            userId: row.userId,
            classroomId: row.event.announcement.classroomId,
          },
        },
      });
      const binding = await tx.pushRegistration.findUnique({
        where: { id: row.registrationId },
        include: bindingInclude,
      });
      const ttl = announcement?.expiresAt
        ? Math.min(
            3600,
            Math.floor(
              (announcement.expiresAt.getTime() - now.getTime()) / 1000,
            ),
          )
        : 0;
      if (
        !member ||
        !announcement ||
        (row.event.kind === 'EXPIRING' &&
          (!announcement.expiresAt ||
            row.event.occurrenceKey !==
              announcementExpirationKey(announcement.expiresAt) ||
            !isAnnouncementReminderDue(announcement, now))) ||
        announcement.authorId === row.userId ||
        ttl < 1 ||
        !binding ||
        !this.sameBinding(row, binding) ||
        !isPushRegistrationEligible({
          registration: binding,
          installation: binding.installation,
          session: binding.session,
          user: binding.user,
          now,
        })
      ) {
        await tx.announcementPushDispatch.update({
          where: { id: row.id },
          data: { state: 'SUPPRESSED', completedAt: now, leaseUntil: null },
        });
        return null;
      }
      await tx.announcementPushDispatch.update({
        where: { id: row.id },
        data: { state: 'SENDING', sendStartedAt: now, leaseUntil: null },
      });
      return {
        id: row.id,
        claimVersion: row.claimVersion,
        announcementId: announcement.id,
        type:
          row.event.kind === 'EXPIRING'
            ? 'announcement-expiring'
            : 'announcement-created',
        expoToken: binding.expoToken!,
        ttl,
      };
    });
  }

  async completeSend(
    row: AnnouncementSendSnapshot,
    result: ExpoSendResult | null,
    now = new Date(),
  ): Promise<void> {
    const data: Prisma.AnnouncementPushDispatchUpdateManyMutationInput =
      result?.kind === 'accepted'
        ? {
            state: 'ACCEPTED',
            providerTicketId: result.ticketId,
            acceptedAt: now,
            nextReceiptCheckAt: new Date(now.getTime() + 15 * 60_000),
            receiptDeadlineAt: new Date(now.getTime() + 24 * 60 * 60_000),
          }
        : {
            state: result ? 'REJECTED' : 'UNKNOWN',
            failureCode:
              result?.kind === 'rejected'
                ? result.code
                : 'PUSH_OUTCOME_UNKNOWN',
            completedAt: now,
          };
    if (
      result?.kind === 'rejected' &&
      result.code === 'DEVICE_NOT_REGISTERED'
    ) {
      const dispatch = await this.prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
        include: dispatchInclude,
      });
      if (!dispatch) return;
      await this.withDispatchLocks(dispatch, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${dispatch.event.announcementId} FOR SHARE`;
        await tx.$queryRaw`SELECT "id" FROM "AnnouncementPushDispatch" WHERE "id" = ${row.id}::uuid FOR UPDATE`;
        const won = await tx.announcementPushDispatch.updateMany({
          where: {
            id: row.id,
            state: 'SENDING',
            claimVersion: row.claimVersion,
          },
          data,
        });
        if (won.count) await this.invalidateBinding(tx, dispatch, now);
      });
      return;
    }
    await this.prisma.announcementPushDispatch.updateMany({
      where: { id: row.id, state: 'SENDING', claimVersion: row.claimVersion },
      data,
    });
  }

  async expire(now = new Date()): Promise<void> {
    await this.prisma.announcementPushDispatch.updateMany({
      where: {
        state: 'SENDING',
        sendStartedAt: { lte: new Date(now.getTime() - 15_000) },
      },
      data: {
        state: 'UNKNOWN',
        failureCode: 'PUSH_OUTCOME_UNKNOWN',
        completedAt: now,
      },
    });
    await this.prisma.announcementPushDispatch.updateMany({
      where: { state: 'ACCEPTED', receiptDeadlineAt: { lte: now } },
      data: {
        state: 'UNKNOWN',
        failureCode: 'PUSH_RECEIPT_DEADLINE_EXCEEDED',
        completedAt: now,
        nextReceiptCheckAt: null,
        receiptLeaseUntil: null,
      },
    });
    // Keep the uniqueness tombstone for the lifetime of the announcement.
    await this.prisma.announcementPushDispatch.updateMany({
      where: {
        state: {
          in: ['PROVIDER_HANDOFF', 'REJECTED', 'UNKNOWN', 'SUPPRESSED'],
        },
        completedAt: { lte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) },
      },
      data: {
        providerTicketId: null,
        failureCode: null,
        nextReceiptCheckAt: null,
        receiptDeadlineAt: null,
        receiptLeaseUntil: null,
      },
    });
  }

  async claimReceipts(now: Date): Promise<ClaimedAnnouncementReceipt[]> {
    const candidates = await this.prisma.announcementPushDispatch.findMany({
      where: {
        state: 'ACCEPTED',
        providerTicketId: { not: null },
        nextReceiptCheckAt: { lte: now },
        receiptDeadlineAt: { gt: now },
        OR: [{ receiptLeaseUntil: null }, { receiptLeaseUntil: { lte: now } }],
      },
      include: dispatchInclude,
      orderBy: { nextReceiptCheckAt: 'asc' },
      take: 100,
    });
    const claimed: ClaimedAnnouncementReceipt[] = [];
    for (const row of candidates) {
      const claimedReceiptLease = new Date(now.getTime() + 60_000);
      const won = await this.prisma.announcementPushDispatch.updateMany({
        where: {
          id: row.id,
          state: 'ACCEPTED',
          receiptLeaseUntil: row.receiptLeaseUntil,
          receiptChecks: row.receiptChecks,
          nextReceiptCheckAt: row.nextReceiptCheckAt,
        },
        data: {
          receiptLeaseUntil: claimedReceiptLease,
          receiptChecks: { increment: 1 },
        },
      });
      if (won.count)
        claimed.push({
          ...row,
          receiptChecks: row.receiptChecks + 1,
          claimedReceiptLease,
        });
    }
    return claimed;
  }

  async completeReceipt(
    row: ClaimedAnnouncementReceipt,
    result: ExpoReceiptResult | undefined,
    now: Date,
  ): Promise<void> {
    const where = {
      id: row.id,
      state: 'ACCEPTED' as const,
      receiptLeaseUntil: row.claimedReceiptLease,
      receiptChecks: row.receiptChecks,
    };
    if (!result) {
      const delays = [60_000, 120_000, 300_000, 900_000];
      await this.prisma.announcementPushDispatch.updateMany({
        where,
        data: {
          receiptLeaseUntil: null,
          nextReceiptCheckAt: new Date(
            Math.min(
              now.getTime() + delays[Math.min(row.receiptChecks - 1, 3)],
              row.receiptDeadlineAt!.getTime(),
            ),
          ),
        },
      });
      return;
    }
    await this.withDispatchLocks(row, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${row.event.announcementId} FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM "AnnouncementPushDispatch" WHERE "id" = ${row.id}::uuid FOR UPDATE`;
      const current = await tx.announcementPushDispatch.findFirst({ where });
      if (!current) return;
      if (result.kind === 'error' && result.code === 'DEVICE_NOT_REGISTERED') {
        await this.invalidateBinding(tx, row, now);
      }
      await tx.announcementPushDispatch.updateMany({
        where,
        data: {
          state: result.kind === 'ok' ? 'PROVIDER_HANDOFF' : 'REJECTED',
          failureCode: result.kind === 'error' ? result.code : null,
          completedAt: now,
          nextReceiptCheckAt: null,
          receiptLeaseUntil: null,
        },
      });
    });
  }

  private async invalidateBinding(
    tx: Prisma.TransactionClient,
    row: ClaimedAnnouncementDispatch,
    now: Date,
  ): Promise<void> {
    await tx.pushRegistration.updateMany({
      where: {
        id: row.registrationId,
        userId: row.userId,
        sessionId: row.sessionId,
        lifecycleVersion: row.lifecycleVersion,
        state: 'ACTIVE',
        tokenRevision: row.tokenRevision,
        tokenFingerprint: row.tokenFingerprint,
      },
      data: {
        state: 'INVALID',
        reason: 'TOKEN_INVALID',
        expoToken: null,
        tokenFingerprint: null,
        platform: null,
        invalidatedAt: now,
      },
    });
  }

  private sameBinding(
    snapshot: Pick<
      AnnouncementPushDispatch,
      | 'userId'
      | 'sessionId'
      | 'installationId'
      | 'lifecycleVersion'
      | 'tokenRevision'
    > & { tokenFingerprint: string | null },
    binding: {
      userId: string;
      sessionId: string;
      installationId: string;
      lifecycleVersion: number;
      tokenRevision: number;
      tokenFingerprint: string | null;
    },
  ): boolean {
    return (
      snapshot.userId === binding.userId &&
      snapshot.sessionId === binding.sessionId &&
      snapshot.installationId === binding.installationId &&
      snapshot.lifecycleVersion === binding.lifecycleVersion &&
      snapshot.tokenRevision === binding.tokenRevision &&
      snapshot.tokenFingerprint === binding.tokenFingerprint
    );
  }

  private withDispatchLocks<T>(
    row: ClaimedAnnouncementDispatch,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.registrations.withAnnouncementLocks(
      {
        userIds: [row.userId],
        classroomId: row.event.announcement.classroomId,
        sessionIds: [row.sessionId],
        installationIds: [row.installationId],
      },
      operation,
    );
  }

  private async lockMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    classroomId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT "userId" FROM "UserClassroom" WHERE "userId" = ${userId} AND "classroomId" = ${classroomId} FOR SHARE`;
  }
}
