import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  type AuthSession,
  type PushInstallation,
  type PushRegistration,
  type User,
} from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivatePushDto } from './dto/activate-push.dto';
import { PushInstallationHeadersDto } from './dto/push-installation-headers.dto';
import { RevokePushDto } from './dto/revoke-push.dto';
import { validatePushDto } from './dto/push-request.validation';
import { createPushConfig } from './push.config';

const INVALID_SESSION = 'PUSH_SESSION_INACTIVE';
const PUSH_BINDING_CONFLICT = 'PUSH_BINDING_CONFLICT';
const PUSH_OPERATION_FAILED = 'PUSH_OPERATION_FAILED';
const PUSH_INSTALLATION_PROOF_INVALID = 'PUSH_INSTALLATION_PROOF_INVALID';
const PUSH_UNAVAILABLE = 'PUSH_UNAVAILABLE';
const PUSH_BINDING_INACTIVE = 'PUSH_BINDING_INACTIVE';
const PUSH_REVISION_CONFLICT = 'PUSH_REVISION_CONFLICT';
const PUSH_TOKEN_CONFLICT = 'PUSH_TOKEN_CONFLICT';
const CAPABILITY_BYTES = 32;

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PushSessionForEligibility {
  id: string;
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface PushRegistrationEligibilityInput {
  installation: Pick<PushInstallation, 'id' | 'lifecycleVersion'>;
  registration: Pick<
    PushRegistration,
    | 'installationId'
    | 'lifecycleVersion'
    | 'userId'
    | 'sessionId'
    | 'state'
    | 'platform'
    | 'expoToken'
    | 'tokenFingerprint'
    | 'tokenRevision'
  >;
  user: Pick<User, 'id'> | null;
  session: PushSessionForEligibility | null;
  now?: Date;
}

export function isPushRegistrationEligible({
  installation,
  registration,
  user,
  session,
  now = new Date(),
}: PushRegistrationEligibilityInput): boolean {
  return (
    registration.state === 'ACTIVE' &&
    registration.installationId === installation.id &&
    registration.lifecycleVersion === installation.lifecycleVersion &&
    registration.platform !== null &&
    registration.expoToken !== null &&
    registration.tokenFingerprint !== null &&
    registration.tokenRevision > 0 &&
    user !== null &&
    user.id === registration.userId &&
    session !== null &&
    session.id === registration.sessionId &&
    session.userId === registration.userId &&
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime()
  );
}

type LockedAuthSession = Pick<
  AuthSession,
  'id' | 'userId' | 'revokedAt' | 'expiresAt'
>;

type AuthenticatedOperation<T> = (
  transaction: Prisma.TransactionClient,
  session: LockedAuthSession,
) => Promise<T>;

type CapabilityOperation<T> = (
  transaction: Prisma.TransactionClient,
) => Promise<T>;

type PushActor = { userId: string; sessionId: string };
type PushProofInput = { installationId: string; capability: string };
type PushOwnerReference = { userId: string; sessionId: string };
type BindingView = {
  bindingId: string;
  lifecycleVersion: number;
  tokenRevision: number;
  state: 'RESERVED' | 'ACTIVE';
};
type InstallationView = {
  available: boolean;
  state: 'ABSENT' | 'RESERVED' | 'ACTIVE' | 'INACTIVE';
  binding: BindingView | null;
  reason:
    | 'CONFIGURATION_UNAVAILABLE'
    | 'REGISTRATION_INACTIVE'
    | 'TOKEN_INVALID'
    | null;
  testAvailableAt: string | null;
};

function capabilityHash(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
  }
  const bytes = Buffer.from(value, 'base64url');
  if (
    bytes.length !== CAPABILITY_BYTES ||
    bytes.toString('base64url') !== value
  ) {
    throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
  }
  return createHash('sha256').update(bytes).digest();
}

function matchesSecret(candidate: Buffer, storedHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(storedHex)) return false;
  const stored = Buffer.from(storedHex, 'hex');
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

function toBindingView(registration: PushRegistration): BindingView {
  return {
    bindingId: registration.id,
    lifecycleVersion: registration.lifecycleVersion,
    tokenRevision: registration.tokenRevision,
    state: registration.state === 'ACTIVE' ? 'ACTIVE' : 'RESERVED',
  };
}

@Injectable()
export class PushRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(actor: PushActor, input: PushProofInput): Promise<BindingView> {
    const headers = validatePushDto(input, PushInstallationHeadersDto);
    const candidateHash = capabilityHash(headers.capability);
    if (!createPushConfig().enabled) {
      throw new ServiceUnavailableException(PUSH_UNAVAILABLE);
    }

    const observedInstallation = await this.prisma.pushInstallation.findUnique({
      where: { id: headers.installationId },
      select: { lifecycleVersion: true },
    });
    const observedCurrent = observedInstallation
      ? await this.prisma.pushRegistration.findUnique({
          where: {
            installationId_lifecycleVersion: {
              installationId: headers.installationId,
              lifecycleVersion: observedInstallation.lifecycleVersion,
            },
          },
          select: { userId: true, sessionId: true },
        })
      : null;

    return this.withOwnerLocks(
      actor,
      observedCurrent ? [observedCurrent] : [],
      [headers.installationId],
      async (transaction, sessions, userIds) => {
        let installation = await transaction.pushInstallation.upsert({
          where: { id: headers.installationId },
          create: {
            id: headers.installationId,
            secretHash: candidateHash.toString('hex'),
          },
          update: {},
        });
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "PushInstallation"
          WHERE "id" = ${headers.installationId}::uuid
          FOR UPDATE
        `;
        if (!matchesSecret(candidateHash, installation.secretHash)) {
          throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
        }

        const current = await transaction.pushRegistration.findFirst({
          where: {
            installationId: headers.installationId,
            lifecycleVersion: installation.lifecycleVersion,
          },
        });
        if (current && !this.ownerWasLocked(current, sessions, userIds)) {
          throw new ConflictException(PUSH_BINDING_CONFLICT);
        }
        if (
          current &&
          current.userId === actor.userId &&
          current.sessionId === actor.sessionId &&
          current.state === 'RESERVED'
        ) {
          return toBindingView(current);
        }
        if (
          current &&
          current.userId === actor.userId &&
          current.sessionId === actor.sessionId &&
          current.state === 'ACTIVE' &&
          isPushRegistrationEligible({
            installation,
            registration: current,
            user: userIds.has(current.userId) ? { id: current.userId } : null,
            session: sessions.get(current.sessionId) ?? null,
          })
        ) {
          return toBindingView(current);
        }
        if (
          current?.state === 'ACTIVE' &&
          isPushRegistrationEligible({
            installation,
            registration: current,
            user: userIds.has(current.userId) ? { id: current.userId } : null,
            session: sessions.get(current.sessionId) ?? null,
          })
        ) {
          throw new ConflictException(PUSH_BINDING_CONFLICT);
        }

        if (current && ['ACTIVE', 'RESERVED'].includes(current.state)) {
          await transaction.pushRegistration.update({
            where: { id: current.id },
            data: {
              state: 'INVALID',
              reason: 'SESSION_INACTIVE',
              expoToken: null,
              tokenFingerprint: null,
              platform: null,
              invalidatedAt: new Date(),
            },
          });
        }

        const lifecycleVersion = installation.lifecycleVersion + 1;
        if (lifecycleVersion > 2147483647) {
          throw new ConflictException(PUSH_BINDING_CONFLICT);
        }
        installation = await transaction.pushInstallation.update({
          where: { id: headers.installationId },
          data: { lifecycleVersion },
        });
        const registration = await transaction.pushRegistration.create({
          data: {
            installationId: installation.id,
            userId: actor.userId,
            sessionId: actor.sessionId,
            lifecycleVersion,
            state: 'RESERVED',
          },
        });
        return toBindingView(registration);
      },
    );
  }

  async getState(
    actor: PushActor,
    input: PushProofInput,
  ): Promise<InstallationView> {
    const headers = validatePushDto(input, PushInstallationHeadersDto);
    const candidateHash = capabilityHash(headers.capability);
    const available = createPushConfig().enabled;

    return this.withAuthenticatedLocks(
      actor.userId,
      actor.sessionId,
      [headers.installationId],
      async (transaction, session) => {
        const installation = await transaction.pushInstallation.findUnique({
          where: { id: headers.installationId },
        });
        if (!installation) {
          return {
            available,
            state: 'ABSENT',
            binding: null,
            reason: available ? null : 'CONFIGURATION_UNAVAILABLE',
            testAvailableAt: null,
          };
        }
        if (!matchesSecret(candidateHash, installation.secretHash)) {
          throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
        }
        if (!available) {
          return {
            available: false,
            state: 'INACTIVE',
            binding: null,
            reason: 'CONFIGURATION_UNAVAILABLE',
            testAvailableAt: null,
          };
        }

        const current = await transaction.pushRegistration.findFirst({
          where: {
            installationId: headers.installationId,
            lifecycleVersion: installation.lifecycleVersion,
          },
        });
        if (!current) {
          return {
            available: true,
            state: 'ABSENT',
            binding: null,
            reason: null,
            testAvailableAt:
              installation.nextTestAvailableAt?.toISOString() ?? null,
          };
        }
        if (
          current.userId !== actor.userId ||
          current.sessionId !== actor.sessionId
        ) {
          return {
            available: true,
            state: 'INACTIVE',
            binding: null,
            reason: null,
            testAvailableAt:
              installation.nextTestAvailableAt?.toISOString() ?? null,
          };
        }
        if (current.state === 'RESERVED') {
          return {
            available: true,
            state: 'RESERVED',
            binding: toBindingView(current),
            reason: null,
            testAvailableAt:
              installation.nextTestAvailableAt?.toISOString() ?? null,
          };
        }
        if (
          current.state === 'ACTIVE' &&
          isPushRegistrationEligible({
            installation,
            registration: current,
            user: { id: actor.userId },
            session,
          })
        ) {
          return {
            available: true,
            state: 'ACTIVE',
            binding: toBindingView(current),
            reason: null,
            testAvailableAt:
              installation.nextTestAvailableAt?.toISOString() ?? null,
          };
        }
        return {
          available: true,
          state: 'INACTIVE',
          binding: null,
          reason:
            current.reason === 'TOKEN_INVALID'
              ? 'TOKEN_INVALID'
              : 'REGISTRATION_INACTIVE',
          testAvailableAt:
            installation.nextTestAvailableAt?.toISOString() ?? null,
        };
      },
    );
  }

  async activate(
    actor: PushActor,
    input: PushProofInput,
    body: unknown,
  ): Promise<BindingView> {
    const headers = validatePushDto(input, PushInstallationHeadersDto);
    const request = validatePushDto(body, ActivatePushDto);
    const candidateHash = capabilityHash(headers.capability);
    if (!createPushConfig().enabled) {
      throw new ServiceUnavailableException(PUSH_UNAVAILABLE);
    }

    const [observedCurrent, observedCollision] = await Promise.all([
      this.prisma.pushRegistration.findUnique({
        where: { id: request.bindingId },
        select: { userId: true, sessionId: true },
      }),
      this.prisma.pushRegistration.findUnique({
        where: { expoToken: request.expoToken },
        select: {
          id: true,
          installationId: true,
          userId: true,
          sessionId: true,
        },
      }),
    ]);
    const ownerReferences = [
      ...(observedCurrent ? [observedCurrent] : []),
      ...(observedCollision ? [observedCollision] : []),
    ];
    const installationIds = [
      headers.installationId,
      ...(observedCollision ? [observedCollision.installationId] : []),
    ];

    return this.withOwnerLocks(
      actor,
      ownerReferences,
      installationIds,
      async (transaction, sessions, userIds) => {
        const installation = await transaction.pushInstallation.findUnique({
          where: { id: headers.installationId },
        });
        if (
          !installation ||
          !matchesSecret(candidateHash, installation.secretHash)
        ) {
          throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
        }
        const current = await transaction.pushRegistration.findUnique({
          where: { id: request.bindingId },
        });
        if (current && !this.ownerWasLocked(current, sessions, userIds)) {
          throw new ConflictException(PUSH_BINDING_INACTIVE);
        }
        if (
          !current ||
          current.installationId !== installation.id ||
          current.lifecycleVersion !== request.lifecycleVersion ||
          installation.lifecycleVersion !== request.lifecycleVersion ||
          current.userId !== actor.userId ||
          current.sessionId !== actor.sessionId ||
          !['RESERVED', 'ACTIVE'].includes(current.state)
        ) {
          throw new ConflictException(PUSH_BINDING_INACTIVE);
        }

        const active = isPushRegistrationEligible({
          installation,
          registration: current,
          user: userIds.has(current.userId) ? { id: current.userId } : null,
          session: sessions.get(current.sessionId) ?? null,
        });
        const sameToken =
          active &&
          current.expoToken === request.expoToken &&
          current.platform === request.platform;
        if (sameToken) {
          if (
            request.expectedTokenRevision !== current.tokenRevision &&
            request.expectedTokenRevision + 1 !== current.tokenRevision
          ) {
            throw new ConflictException(PUSH_REVISION_CONFLICT);
          }
          return toBindingView(current);
        }
        if (current.tokenRevision !== request.expectedTokenRevision) {
          throw new ConflictException(PUSH_REVISION_CONFLICT);
        }

        const collision = await transaction.pushRegistration.findUnique({
          where: { expoToken: request.expoToken },
        });
        if (collision && collision.id !== current.id) {
          if (
            !this.ownerWasLocked(collision, sessions, userIds) ||
            !installationIds.some(
              (id) =>
                id.toLowerCase() === collision.installationId.toLowerCase(),
            )
          ) {
            throw new ConflictException(PUSH_TOKEN_CONFLICT);
          }
          const collisionInstallation =
            await transaction.pushInstallation.findUnique({
              where: { id: collision.installationId },
            });
          if (!collisionInstallation) {
            throw new ConflictException(PUSH_TOKEN_CONFLICT);
          }
          const collisionEligible = isPushRegistrationEligible({
            installation: collisionInstallation,
            registration: collision,
            user: userIds.has(collision.userId)
              ? { id: collision.userId }
              : null,
            session: sessions.get(collision.sessionId) ?? null,
          });
          if (collisionEligible) {
            throw new ConflictException(PUSH_TOKEN_CONFLICT);
          }
          await transaction.pushRegistration.update({
            where: { id: collision.id },
            data: {
              state: 'INVALID',
              reason: 'SESSION_INACTIVE',
              expoToken: null,
              tokenFingerprint: null,
              platform: null,
              invalidatedAt: new Date(),
            },
          });
        }
        if (current.tokenRevision >= 2147483647) {
          throw new ConflictException(PUSH_REVISION_CONFLICT);
        }
        const fingerprint = createHash('sha256')
          .update(request.expoToken)
          .digest('hex');
        const registration = await transaction.pushRegistration.update({
          where: { id: current.id },
          data: {
            state: 'ACTIVE',
            reason: null,
            platform: request.platform,
            expoToken: request.expoToken,
            tokenFingerprint: fingerprint,
            tokenRevision: current.tokenRevision + 1,
            activatedAt: new Date(),
            invalidatedAt: null,
          },
        });
        return toBindingView(registration);
      },
    );
  }

  async revoke(input: PushProofInput, body: unknown): Promise<void> {
    const headers = validatePushDto(input, PushInstallationHeadersDto);
    const request = validatePushDto(body, RevokePushDto);
    const candidateHash = capabilityHash(headers.capability);
    const exists = await this.prisma.pushInstallation.findUnique({
      where: { id: headers.installationId },
      select: { id: true },
    });
    if (!exists) return;

    await this.withCapabilityLocks(
      headers.installationId,
      async (transaction) => {
        const installation = await transaction.pushInstallation.findUnique({
          where: { id: headers.installationId },
        });
        if (!installation) return;
        if (!matchesSecret(candidateHash, installation.secretHash)) {
          throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
        }
        const current = await transaction.pushRegistration.findUnique({
          where: { id: request.bindingId },
        });
        if (
          !current ||
          current.installationId !== installation.id ||
          current.lifecycleVersion !== request.lifecycleVersion
        ) {
          return;
        }
        if (current.state === 'REVOKED') return;
        await transaction.pushRegistration.update({
          where: { id: current.id },
          data: {
            state: 'REVOKED',
            reason: request.reason,
            expoToken: null,
            tokenFingerprint: null,
            platform: null,
            invalidatedAt: new Date(),
          },
        });
      },
    );
  }

  async cleanupInactiveRegistrations(
    now = new Date(),
  ): Promise<{ registrationsDeleted: number; installationsDeleted: number }> {
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleStateWhere: Prisma.PushRegistrationWhereInput = {
      state: { in: ['RESERVED', 'REVOKED', 'INVALID'] },
      updatedAt: { lte: cutoff },
    };
    const inactiveSessionWhere: Prisma.PushRegistrationWhereInput = {
      session: {
        is: {
          OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: now } }],
        },
      },
    };

    return this.runInTransaction(async (transaction) => {
      const candidates = await transaction.pushRegistration.findMany({
        where: { OR: [staleStateWhere, inactiveSessionWhere] },
        select: {
          id: true,
          userId: true,
          sessionId: true,
          installationId: true,
        },
      });
      const orphanInstallations = await transaction.pushInstallation.findMany({
        where: {
          createdAt: { lte: cutoff },
          registrations: { none: {} },
          testAttempts: { none: {} },
        },
        select: { id: true },
      });

      const userIds = [
        ...new Set(candidates.map(({ userId }) => userId)),
      ].sort();
      const sessionOwners = new Map<string, string>();
      for (const candidate of candidates) {
        sessionOwners.set(candidate.sessionId, candidate.userId);
      }
      for (const userId of userIds) {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
        `;
      }
      for (const sessionId of [...sessionOwners.keys()].sort()) {
        const userId = sessionOwners.get(sessionId)!;
        await transaction.$queryRaw<LockedAuthSession[]>`
          SELECT "id", "userId", "revokedAt", "expiresAt"
          FROM "AuthSession"
          WHERE "id" = ${sessionId} AND "userId" = ${userId}
          FOR UPDATE
        `;
      }

      const installationIds = this.normalizeInstallationIds([
        ...candidates.map(({ installationId }) => installationId),
        ...orphanInstallations.map(({ id }) => id),
      ]);
      await this.lockInstallationsAndRegistrations(
        transaction,
        installationIds,
      );

      const candidateIds = candidates.map(({ id }) => id);
      const stillDeletable = candidateIds.length
        ? await transaction.pushRegistration.findMany({
            where: {
              id: { in: candidateIds },
              OR: [staleStateWhere, inactiveSessionWhere],
            },
            select: { id: true },
          })
        : [];
      const registrationsDeleted = stillDeletable.length
        ? (
            await transaction.pushRegistration.deleteMany({
              where: { id: { in: stillDeletable.map(({ id }) => id) } },
            })
          ).count
        : 0;
      const newlyOrphanedInstallations = installationIds.length
        ? await transaction.pushInstallation.findMany({
            where: {
              id: { in: installationIds },
              createdAt: { lte: cutoff },
              registrations: { none: {} },
              testAttempts: { none: {} },
            },
            select: { id: true },
          })
        : [];
      const installationsDeleted = newlyOrphanedInstallations.length
        ? (
            await transaction.pushInstallation.deleteMany({
              where: {
                id: { in: newlyOrphanedInstallations.map(({ id }) => id) },
                createdAt: { lte: cutoff },
                registrations: { none: {} },
                testAttempts: { none: {} },
              },
            })
          ).count
        : 0;

      return { registrationsDeleted, installationsDeleted };
    });
  }

  async withAuthenticatedLocks<T>(
    userId: string,
    sessionId: string,
    installationIds: string[],
    operation: AuthenticatedOperation<T>,
    now = new Date(),
  ): Promise<T> {
    const ids = this.normalizeInstallationIds(installationIds);

    return this.runInTransaction(async (transaction) => {
      const users = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      if (users.length === 0) {
        throw new UnauthorizedException(INVALID_SESSION);
      }

      const sessions = await transaction.$queryRaw<LockedAuthSession[]>`
        SELECT "id", "userId", "revokedAt", "expiresAt"
        FROM "AuthSession"
        WHERE "id" = ${sessionId} AND "userId" = ${userId}
        FOR UPDATE
      `;
      const session = sessions[0];
      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        throw new UnauthorizedException(INVALID_SESSION);
      }

      await this.lockInstallationsAndRegistrations(transaction, ids);
      return operation(transaction, session);
    });
  }

  async withAuthenticatedProofLocks<T>(
    actor: PushActor,
    input: PushProofInput,
    operation: (
      transaction: Prisma.TransactionClient,
      session: LockedAuthSession,
      installation: PushInstallation,
      registration: PushRegistration | null,
    ) => Promise<T>,
  ): Promise<T> {
    const headers = validatePushDto(input, PushInstallationHeadersDto);
    const candidateHash = capabilityHash(headers.capability);
    return this.withAuthenticatedLocks(
      actor.userId,
      actor.sessionId,
      [headers.installationId],
      async (transaction, session) => {
        const installation = await transaction.pushInstallation.findUnique({
          where: { id: headers.installationId },
        });
        if (
          !installation ||
          !matchesSecret(candidateHash, installation.secretHash)
        ) {
          throw new ForbiddenException(PUSH_INSTALLATION_PROOF_INVALID);
        }
        const registration = await transaction.pushRegistration.findFirst({
          where: {
            installationId: installation.id,
            lifecycleVersion: installation.lifecycleVersion,
          },
        });
        return operation(transaction, session, installation, registration);
      },
    );
  }

  private async withOwnerLocks<T>(
    actor: PushActor,
    additionalOwners: PushOwnerReference[],
    installationIds: string[],
    operation: (
      transaction: Prisma.TransactionClient,
      sessions: Map<string, LockedAuthSession>,
      userIds: Set<string>,
    ) => Promise<T>,
  ): Promise<T> {
    const owners = [
      { userId: actor.userId, sessionId: actor.sessionId },
      ...additionalOwners,
    ];
    const userIds = [...new Set(owners.map(({ userId }) => userId))].sort();
    const sessionsById = new Map<string, PushOwnerReference>();
    for (const owner of owners) sessionsById.set(owner.sessionId, owner);
    const sessionIds = [...sessionsById.keys()].sort();
    const ids = this.normalizeInstallationIds(installationIds);

    return this.runInTransaction(async (transaction) => {
      const lockedUsers = new Set<string>();
      for (const userId of userIds) {
        const users = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
        `;
        if (users.length > 0) lockedUsers.add(userId);
      }
      if (!lockedUsers.has(actor.userId)) {
        throw new UnauthorizedException(INVALID_SESSION);
      }

      const lockedSessions = new Map<string, LockedAuthSession>();
      for (const sessionId of sessionIds) {
        const owner = sessionsById.get(sessionId)!;
        const rows = await transaction.$queryRaw<LockedAuthSession[]>`
          SELECT "id", "userId", "revokedAt", "expiresAt"
          FROM "AuthSession"
          WHERE "id" = ${sessionId} AND "userId" = ${owner.userId}
          FOR UPDATE
        `;
        if (rows[0]) lockedSessions.set(sessionId, rows[0]);
      }

      const actorSession = lockedSessions.get(actor.sessionId);
      if (
        !actorSession ||
        actorSession.revokedAt !== null ||
        actorSession.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException(INVALID_SESSION);
      }

      await this.lockInstallationsAndRegistrations(transaction, ids);
      return operation(transaction, lockedSessions, lockedUsers);
    });
  }

  private ownerWasLocked(
    registration: Pick<PushRegistration, 'userId' | 'sessionId'>,
    sessions: Map<string, LockedAuthSession>,
    userIds: Set<string>,
  ): boolean {
    const session = sessions.get(registration.sessionId);
    return (
      userIds.has(registration.userId) &&
      session?.userId === registration.userId
    );
  }

  async withCapabilityLocks<T>(
    installationId: string,
    operation: CapabilityOperation<T>,
  ): Promise<T> {
    const [id] = this.normalizeInstallationIds([installationId]);

    return this.runInTransaction(async (transaction) => {
      await this.lockInstallationsAndRegistrations(transaction, [id]);
      return operation(transaction);
    });
  }

  private normalizeInstallationIds(ids: string[]): string[] {
    if (ids.some((id) => !uuidV4Pattern.test(id))) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const uniqueIds = [...new Set(ids.map((id) => id.toLowerCase()))];
    return uniqueIds.sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
  }

  private async lockInstallationsAndRegistrations(
    transaction: Prisma.TransactionClient,
    installationIds: string[],
  ): Promise<void> {
    for (const installationId of installationIds) {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "PushInstallation"
        WHERE "id" = ${installationId}::uuid
        FOR UPDATE
      `;
    }

    for (const installationId of installationIds) {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "PushRegistration"
        WHERE "installationId" = ${installationId}::uuid
        ORDER BY "id"
        FOR UPDATE
      `;
    }
  }

  private async runInTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(PUSH_BINDING_CONFLICT);
      }

      throw new InternalServerErrorException(PUSH_OPERATION_FAILED);
    }
  }
}
