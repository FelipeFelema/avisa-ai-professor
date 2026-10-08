import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import { SessionRevocationService } from './session-revocation.service';

describe('SessionRevocationService', () => {
  const sid = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const config = {
    getOrThrow: jest.fn(() => 'synthetic-revocation-test-secret'),
  };
  const prisma = { authSession: { findUnique: jest.fn() } };
  const tx = { authSession: { updateMany: jest.fn() } };
  const sessions = { findActive: jest.fn(), withUserLock: jest.fn() };
  let service: SessionRevocationService;
  beforeEach(() => {
    jest.clearAllMocks();
    sessions.findActive.mockResolvedValue({ id: sid });
    prisma.authSession.findUnique.mockResolvedValue({
      userId: 'internal-user',
    });
    sessions.withUserLock.mockImplementation(
      (_id: string, operation: (tx: unknown) => Promise<void>) => operation(tx),
    );
    service = new SessionRevocationService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      sessions as unknown as AuthSessionService,
    );
  });
  it('issues a stable revoke-only capability with no identity/auth credentials', async () => {
    const ticket = await service.issue('internal-user', sid);
    expect(Object.keys(ticket).sort()).toEqual(['capability', 'sid']);
    expect(ticket.capability).toHaveLength(43);
    expect(await service.issue('internal-user', sid)).toEqual(ticket);
    expect((await service.issue('internal-user', other)).capability).not.toBe(
      ticket.capability,
    );
  });
  it('does not issue for an inactive or foreign session', async () => {
    sessions.findActive.mockResolvedValue(null);
    await expect(service.issue('foreign', sid)).rejects.toThrow('Unauthorized');
  });
  it('locks the owning User and conditionally revokes only the matching session', async () => {
    const ticket = await service.issue('internal-user', sid);
    await service.revoke(ticket);
    expect(sessions.withUserLock).toHaveBeenCalledWith(
      'internal-user',
      expect.any(Function),
    );
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: sid, userId: 'internal-user', revokedAt: null },
      data: { revokedAt: expect.any(Date) as unknown as Date },
    });
  });
  it('validates capability before persistence and cannot substitute a sid', async () => {
    const ticket = await service.issue('internal-user', sid);
    await expect(service.revoke({ ...ticket, sid: other })).rejects.toThrow(
      'Unauthorized',
    );
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });
  it('acknowledges an absent sid idempotently and sanitizes persistence failures', async () => {
    const ticket = await service.issue('internal-user', sid);
    prisma.authSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.revoke(ticket)).resolves.toBeUndefined();
    prisma.authSession.findUnique.mockRejectedValueOnce(
      new Error('PRIVATE SQL password'),
    );
    await expect(service.revoke(ticket)).rejects.toThrow(
      'Não foi possível encerrar a sessão.',
    );
  });
});
