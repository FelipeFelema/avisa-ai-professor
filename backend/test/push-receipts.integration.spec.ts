import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExpoPushAdapter } from '../src/push/expo-push.adapter';
import { PushReceiptsWorker } from '../src/push/push-receipts.worker';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { createTestApp } from './helpers/test-app.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';

type Actor = { userId: string; sessionId: string; token: string };
type Proof = { installationId: string; capability: string };
type Binding = {
  bindingId: string;
  lifecycleVersion: number;
  tokenRevision: number;
};

const INSTALLATION_PATH = '/api/v1/push/installation';
const TEST_PATH = `${INSTALLATION_PATH}/test`;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('push receipt processing PostgreSQL integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let oldEnabled: string | undefined;
  let oldAccessToken: string | undefined;

  async function createActor(): Promise<Actor> {
    const user = await prisma.user.create({
      data: {
        name: 'Push receipt integration',
        email: `push-receipt-${randomUUID()}@example.test`,
        password: 'synthetic-hash',
        role: Role.PARENT,
      },
    });
    const session = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        refreshTokenHash: 'synthetic-refresh-hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    return {
      userId: user.id,
      sessionId: session.id,
      token: app.get(JwtService).sign(
        { sub: user.id, sid: session.id, email: user.email, role: user.role },
        {
          secret: app
            .get(ConfigService)
            .getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '15m',
        },
      ),
    };
  }

  function proof(): Proof {
    return {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
  }

  function authenticated(
    method: 'post' | 'put' | 'delete',
    path: string,
    actor: Actor,
    identity: Proof,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .auth(actor.token, { type: 'bearer' })
      .set('X-Push-Installation', identity.installationId)
      .set('X-Push-Capability', identity.capability);
  }

  async function activate(
    actor: Actor,
    identity: Proof,
    expoToken = 'ExpoPushToken[synthetic-receipt-token-01]',
  ): Promise<Binding> {
    const reserved = await authenticated(
      'post',
      `${INSTALLATION_PATH}/reserve`,
      actor,
      identity,
    )
      .send({})
      .expect(200);
    const binding = reserved.body as Binding;
    await authenticated('put', INSTALLATION_PATH, actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken,
        permission: 'GRANTED',
      })
      .expect(200);
    return { ...binding, tokenRevision: 1 };
  }

  async function sendTest(actor: Actor, identity: Proof, ticketId: string) {
    jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (requestUrl(input).endsWith('/send')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ status: 'ok', id: ticketId }] }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      throw new Error('Unexpected receipt request before the due time.');
    });
    const response = await authenticated('post', TEST_PATH, actor, identity)
      .send({})
      .expect(202);
    return response.body as { attemptId: string; status: 'ACCEPTED' };
  }

  function makeDue(attemptId: string, receiptLeaseUntil: Date | null = null) {
    return prisma.pushTestAttempt.update({
      where: { id: attemptId },
      data: {
        nextReceiptCheckAt: new Date(Date.now() - 1000),
        receiptDeadlineAt: new Date(Date.now() + 24 * 60 * 60_000),
        receiptLeaseUntil,
      },
    });
  }

  function disableCleanupOnWorker(worker: PushReceiptsWorker): void {
    (worker as unknown as { nextCleanupAt: number }).nextCleanupAt =
      Date.now() + 24 * 60 * 60_000;
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    oldEnabled = process.env.EXPO_PUSH_ENABLED;
    oldAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-token';
    app = (await createTestApp({
      configureBuilder: (builder) =>
        builder
          .overrideGuard(RateLimitGuard)
          .useValue({ canActivate: () => true }),
    })) as INestApplication<App>;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => clearTestDatabase(prisma));
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await app.close();
    if (oldEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = oldEnabled;
    if (oldAccessToken === undefined) delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = oldAccessToken;
  });

  it('resumes an expired receipt lease after worker restart without sending again', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = await activate(actor, identity);
    const result = await sendTest(actor, identity, 'synthetic-restart-ticket');
    await makeDue(result.attemptId, new Date(Date.now() - 1000));
    const registrationService = app.get(PushRegistrationService);
    const adapter = app.get(ExpoPushAdapter);
    const getReceipts = jest.spyOn(adapter, 'getReceipts').mockResolvedValue({
      'synthetic-restart-ticket': { kind: 'ok' },
    });
    const workerAfterRestart = new PushReceiptsWorker(
      prisma,
      registrationService,
      adapter,
    );
    disableCleanupOnWorker(workerAfterRestart);

    await workerAfterRestart.tick(new Date());

    expect(getReceipts).toHaveBeenCalledTimes(1);
    expect(
      await prisma.pushTestAttempt.findUniqueOrThrow({
        where: { id: result.attemptId },
      }),
    ).toMatchObject({
      state: 'PROVIDER_HANDOFF',
      providerTicketId: 'synthetic-restart-ticket',
    });
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: binding.bindingId },
      }),
    ).toMatchObject({
      state: 'ACTIVE',
      tokenRevision: 1,
    });
    await workerAfterRestart.onModuleDestroy();
  });

  it('uses database CAS leases so two workers make only one receipt call', async () => {
    const actor = await createActor();
    const identity = proof();
    await activate(actor, identity);
    const result = await sendTest(actor, identity, 'synthetic-lease-ticket');
    await makeDue(result.attemptId);
    const registrations = app.get(PushRegistrationService);
    const adapter = app.get(ExpoPushAdapter);
    const due = new Promise<void>((resolve) => setTimeout(resolve, 30));
    const getReceipts = jest
      .spyOn(adapter, 'getReceipts')
      .mockImplementation(async () => {
        await due;
        return { 'synthetic-lease-ticket': { kind: 'ok' } };
      });
    const first = new PushReceiptsWorker(prisma, registrations, adapter);
    const second = new PushReceiptsWorker(prisma, registrations, adapter);
    disableCleanupOnWorker(first);
    disableCleanupOnWorker(second);

    await Promise.all([first.tick(new Date()), second.tick(new Date())]);

    expect(getReceipts).toHaveBeenCalledTimes(1);
    expect(
      await prisma.pushTestAttempt.findUniqueOrThrow({
        where: { id: result.attemptId },
      }),
    ).toMatchObject({
      state: 'PROVIDER_HANDOFF',
      receiptLeaseUntil: null,
    });
    await Promise.all([first.onModuleDestroy(), second.onModuleDestroy()]);
  });

  it('does not let an old permanent receipt invalidate a rotated Expo token', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = await activate(actor, identity);
    const result = await sendTest(
      actor,
      identity,
      'synthetic-old-revision-ticket',
    );
    await authenticated('put', INSTALLATION_PATH, actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        expectedTokenRevision: 1,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-rotated-token-02]',
        permission: 'GRANTED',
      })
      .expect(200);
    await makeDue(result.attemptId);
    const adapter = app.get(ExpoPushAdapter);
    const getReceipts = jest.spyOn(adapter, 'getReceipts').mockResolvedValue({
      'synthetic-old-revision-ticket': {
        kind: 'error',
        code: 'DEVICE_NOT_REGISTERED',
      },
    });
    const worker = new PushReceiptsWorker(
      prisma,
      app.get(PushRegistrationService),
      adapter,
    );
    disableCleanupOnWorker(worker);

    await worker.tick(new Date());

    expect(getReceipts).toHaveBeenCalledTimes(1);
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: binding.bindingId },
      }),
    ).toMatchObject({
      state: 'ACTIVE',
      tokenRevision: 2,
      expoToken: 'ExpoPushToken[synthetic-rotated-token-02]',
    });
    expect(
      await prisma.pushTestAttempt.findUniqueOrThrow({
        where: { id: result.attemptId },
      }),
    ).toMatchObject({
      state: 'REJECTED',
      failureCode: 'DEVICE_NOT_REGISTERED',
    });
    await worker.onModuleDestroy();
  });

  it('keeps logout terminal and does not recreate attempts after account cascade', async () => {
    const actor = await createActor();
    const identity = proof();
    const binding = await activate(actor, identity);
    const result = await sendTest(actor, identity, 'synthetic-logout-ticket');
    await authenticated('delete', INSTALLATION_PATH, actor, identity)
      .send({
        bindingId: binding.bindingId,
        lifecycleVersion: binding.lifecycleVersion,
        reason: 'LOGOUT',
      })
      .expect(204);
    await makeDue(result.attemptId);
    const adapter = app.get(ExpoPushAdapter);
    jest.spyOn(adapter, 'getReceipts').mockResolvedValue({
      'synthetic-logout-ticket': {
        kind: 'error',
        code: 'DEVICE_NOT_REGISTERED',
      },
    });
    const worker = new PushReceiptsWorker(
      prisma,
      app.get(PushRegistrationService),
      adapter,
    );
    disableCleanupOnWorker(worker);

    await worker.tick(new Date());
    expect(
      await prisma.pushRegistration.findUniqueOrThrow({
        where: { id: binding.bindingId },
      }),
    ).toMatchObject({
      state: 'REVOKED',
      expoToken: null,
    });
    await prisma.user.delete({ where: { id: actor.userId } });
    expect(
      await prisma.pushTestAttempt.findUnique({
        where: { id: result.attemptId },
      }),
    ).toBeNull();
    await worker.tick(new Date(Date.now() + 60_000));
    expect(await prisma.pushTestAttempt.count()).toBe(0);
    await worker.onModuleDestroy();
  });
});
