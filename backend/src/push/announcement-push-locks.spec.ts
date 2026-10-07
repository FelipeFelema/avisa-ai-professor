import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushRegistrationService } from './push-registration.service';

describe('business push ordered parent locks', () => {
  it('locks all users before classroom then sessions and existing installation primitives', async () => {
    const statements: string[] = [];
    const tx = {
      $queryRaw: jest.fn((sql: TemplateStringsArray) => {
        statements.push(sql.join('?'));
        return Promise.resolve([]);
      }),
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: jest.fn(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(tx),
      ),
    } as unknown as PrismaService;
    const service = new PushRegistrationService(prisma);
    const callback = jest.fn().mockResolvedValue('completed');
    expect(
      await service.withAnnouncementLocks(
        {
          userIds: ['b', 'a', 'a'],
          classroomId: 'classroom',
          sessionIds: ['s2', 's1'],
          installationIds: ['00000000-0000-4000-8000-000000000001'],
        },
        callback,
      ),
    ).toBe('completed');
    expect(statements.map((sql) => sql.match(/FROM "([^"]+)"/)?.[1])).toEqual([
      'User',
      'User',
      'Classroom',
      'AuthSession',
      'AuthSession',
      'PushInstallation',
      'PushRegistration',
    ]);
    expect(callback).toHaveBeenCalledWith(tx);
  });

  it('does not accept a fabricated non-UUID installation or start a transaction', async () => {
    const transaction = jest.fn();
    const service = new PushRegistrationService({
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(
      service.withAnnouncementLocks(
        {
          userIds: ['user'],
          classroomId: 'classroom',
          sessionIds: ['session'],
          installationIds: ['not-an-installation'],
        },
        jest.fn(),
      ),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
