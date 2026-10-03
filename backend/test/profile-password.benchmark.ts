// Explicit local benchmark, outside Jest discovery. Select a protected test DB first.
import 'dotenv/config';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { scrypt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { RateLimitGuard } from '../src/auth/guards/rate-limit.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  hashPassword,
  verifyPassword,
} from '../src/common/security/password-hasher';
import { createTestApp } from './helpers/test-app.helper';
import { assertSafeTestDatabase } from './helpers/test-database.helper';
import { createSyntheticProfileUser } from './helpers/profile-password.helper';

const concurrencyLevels = [1, 2, 4, 8];
const rounds = 3;
const credentials = [
  'Synthetic benchmark initial value',
  'Synthetic benchmark replacement value',
];

function summary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) =>
    Math.round(sorted[Math.ceil(sorted.length * p) - 1]);
  return {
    samples: sorted.length,
    minMs: Math.round(sorted[0]),
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: Math.round(sorted[sorted.length - 1]),
  };
}

async function measure(
  concurrency: number,
  operation: (index: number, round: number) => Promise<void>,
) {
  const samples: number[] = [];
  let peakRss = process.memoryUsage().rss;
  const memorySampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 10);
  try {
    for (let round = 0; round < rounds; round++) {
      await Promise.all(
        Array.from({ length: concurrency }, async (_, index) => {
          const started = performance.now();
          await operation(index, round);
          samples.push(performance.now() - started);
        }),
      );
    }
    return { ...summary(samples), peakRssMiB: Math.round(peakRss / 1024 ** 2) };
  } finally {
    clearInterval(memorySampler);
  }
}

async function main() {
  const database = assertSafeTestDatabase();
  // Cost measurement bypasses the per-IP attempt cap; acceptance tests prove the real guard.
  const app = await createTestApp({
    configureBuilder: (builder) => {
      builder
        .overrideGuard(RateLimitGuard)
        .useValue({ canActivate: () => true });
    },
  });
  app.useLogger(false);
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const sessions = app.get(AuthSessionService);
  const ids: string[] = [];
  const lockSamples: number[] = [];
  const originalLock = sessions.withUserLock.bind(
    sessions,
  ) as AuthSessionService['withUserLock'];
  const rows: object[] = [];
  try {
    const stored = await hashPassword(credentials[0]);
    const fixtures: Array<{ token: string }> = [];
    for (let index = 0; index < Math.max(...concurrencyLevels); index++) {
      const user = await createSyntheticProfileUser(prisma);
      ids.push(user.id);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: stored },
      });
      const first = await auth.login(user.email, credentials[0]);
      await auth.login(user.email, credentials[0]);
      fixtures.push({ token: first.access_token });
    }
    sessions.withUserLock = <T>(
      userId: string,
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ) =>
      originalLock(userId, async (tx) => {
        const started = performance.now();
        try {
          return await operation(tx);
        } finally {
          lockSamples.push(performance.now() - started);
        }
      });
    for (const concurrency of concurrencyLevels) {
      const hash = await measure(concurrency, async () => {
        await hashPassword(credentials[0]);
      });
      const verify = await measure(concurrency, async () => {
        if (!(await verifyPassword(credentials[0], stored)))
          throw new Error('Benchmark verification failed.');
      });
      // Reset outside the measured interval; each account has its own User lock.
      for (const id of ids)
        await prisma.user.update({ where: { id }, data: { password: stored } });
      lockSamples.length = 0;
      const http = await measure(concurrency, async (index, round) => {
        const currentPassword = credentials[round % 2];
        const newPassword = credentials[(round + 1) % 2];
        const response = await request(app.getHttpServer() as App)
          .post('/api/v1/auth/change-password')
          .auth(fixtures[index].token, { type: 'bearer' })
          .send({
            currentPassword,
            newPassword,
            confirmNewPassword: newPassword,
          });
        if (response.status !== 204 || response.text !== '')
          throw new Error('Benchmark HTTP operation failed.');
      });
      rows.push({
        concurrency,
        hash,
        verify,
        http,
        lockedCallback: summary(lockSamples),
      });
    }
    const constrainedMemoryRejected = await new Promise<boolean>((resolve) => {
      try {
        scrypt(
          credentials[0],
          Buffer.alloc(16),
          32,
          { N: 32768, r: 8, p: 3, maxmem: 1024 ** 2 },
          () => resolve(false),
        );
      } catch (error) {
        resolve(
          error instanceof Error &&
            'code' in error &&
            error.code === 'ERR_CRYPTO_INVALID_SCRYPT_PARAMS',
        );
      }
    });
    if (!constrainedMemoryRejected)
      throw new Error('Memory constraint probe failed.');
    console.log(
      JSON.stringify(
        {
          environment: {
            platform: process.platform,
            node: process.version,
            cpu: cpus()[0].model,
            logicalCpus: cpus().length,
            ramGiB: Math.round(totalmem() / 1024 ** 3),
            uvThreadpoolSize: process.env.UV_THREADPOOL_SIZE ?? 'default (4)',
            database: database.pathname.slice(1),
            rounds,
          },
          constrainedMemoryRejected,
          rows,
        },
        null,
        2,
      ),
    );
  } finally {
    sessions.withUserLock = originalLock;
    try {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await app.close();
    }
  }
}

void main().catch(() => {
  console.error('Benchmark failed; credential-bearing diagnostics omitted.');
  process.exitCode = 1;
});
