import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as passwordHasher from '../common/security/password-hasher';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { UsersService } from '../users/users.service';

jest.mock('../common/security/password-hasher', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));
jest.mock('crypto', () => ({ randomUUID: jest.fn(() => 'session-id') }));

const users = {
  findByEmail: jest.fn(),
  findByIdInternal: jest.fn(),
  createUser: jest.fn(),
};
const sessions = {
  create: jest.fn(),
  prepareRefreshTokenHash: jest.fn(),
  createInTransaction: jest.fn(),
  withUserLock: jest.fn(),
  findActive: jest.fn(),
  verifyRefreshToken: jest.fn(),
  rotate: jest.fn(),
  findActiveInTransaction: jest.fn(),
  revokeOthersInTransaction: jest.fn(),
};
const jwt = { sign: jest.fn(() => 'token'), verify: jest.fn() };
const config = { getOrThrow: jest.fn(() => 'secret') };
const lockedTx = { user: { findUnique: jest.fn(), update: jest.fn() } };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: AuthSessionService, useValue: sessions },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    sessions.withUserLock.mockReset();
    (passwordHasher.hashPassword as jest.Mock).mockReset();
    (passwordHasher.verifyPassword as jest.Mock).mockResolvedValue(true);
    sessions.prepareRefreshTokenHash.mockResolvedValue('prepared-refresh-hash');
    users.findByIdInternal.mockResolvedValue({ password: 'stored-hash' });
    (passwordHasher.hashPassword as jest.Mock).mockResolvedValue(
      'replacement-hash',
    );
    sessions.findActiveInTransaction.mockResolvedValue({ id: 'session-id' });
    lockedTx.user.findUnique.mockResolvedValue({ password: 'stored-hash' });
    sessions.withUserLock.mockImplementation(async (...args: unknown[]) => {
      const callback = args[1] as (tx: typeof lockedTx) => Promise<unknown>;
      return callback(lockedTx);
    });
  });

  describe('changePassword', () => {
    const body = {
      currentPassword: 'Synthetic old password',
      newPassword: 'Synthetic new password',
      confirmNewPassword: 'Synthetic new password',
    };
    it('writes and revokes on the locked transaction, preserving initiating tokens', async () => {
      const result = await service.changePassword(
        'user-id',
        'session-id',
        body,
      );
      expect(result).toBeUndefined();
      expect(sessions.findActiveInTransaction).toHaveBeenCalledWith(
        lockedTx,
        'user-id',
        'session-id',
      );
      expect(lockedTx.user.update).toHaveBeenCalledTimes(1);
      const calls = lockedTx.user.update.mock.calls as unknown as Array<
        [{ data: { password: string } }]
      >;
      expect(calls[0][0].data.password === 'replacement-hash').toBe(true);
      expect(sessions.revokeOthersInTransaction).toHaveBeenCalledWith(
        lockedTx,
        'user-id',
        'session-id',
      );
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(sessions.rotate).not.toHaveBeenCalled();
      expect(
        (passwordHasher.hashPassword as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan(sessions.withUserLock.mock.invocationCallOrder[0]);
    });
    it.each([
      ['wrong current', 'CURRENT_PASSWORD_INVALID'],
      ['unchanged', 'PASSWORD_UNCHANGED'],
      ['mismatch', 'PASSWORD_CONFIRMATION_MISMATCH'],
    ])('rejects %s before writing', async (scenario, message) => {
      const request = { ...body };
      if (scenario === 'wrong current')
        (passwordHasher.verifyPassword as jest.Mock).mockResolvedValue(false);
      if (scenario === 'unchanged')
        request.newPassword = request.confirmNewPassword =
          request.currentPassword;
      if (scenario === 'mismatch') request.confirmNewPassword += ' ';
      await expect(
        service.changePassword('user-id', 'session-id', request),
      ).rejects.toThrow(message);
      expect(lockedTx.user.update).not.toHaveBeenCalled();
      expect(sessions.revokeOthersInTransaction).not.toHaveBeenCalled();
    });
    it('rejects stale snapshots and invalid sid without writes', async () => {
      lockedTx.user.findUnique.mockResolvedValue({ password: 'changed' });
      await expect(
        service.changePassword('user-id', 'session-id', body),
      ).rejects.toThrow('CREDENTIAL_CHANGED');
      sessions.findActiveInTransaction.mockResolvedValue(null);
      await expect(
        service.changePassword('user-id', 'session-id', body),
      ).rejects.toThrow(UnauthorizedException);
      expect(lockedTx.user.update).not.toHaveBeenCalled();
    });
    it('sanitizes transactional and hashing errors without retaining cause', async () => {
      sessions.withUserLock.mockRejectedValueOnce(
        new Error(body.currentPassword),
      );
      let error: unknown;
      try {
        await service.changePassword('user-id', 'session-id', body);
      } catch (caught) {
        error = caught;
      }
      expect(
        error instanceof Error &&
          !error.message.includes(body.currentPassword) &&
          !('cause' in error),
      ).toBe(true);
      (passwordHasher.hashPassword as jest.Mock).mockRejectedValueOnce(
        new Error(body.newPassword),
      );
      error = undefined;
      try {
        await service.changePassword('user-id', 'session-id', body);
      } catch (caught) {
        error = caught;
      }
      expect(
        error instanceof Error &&
          error.message === 'Não foi possível alterar a senha.' &&
          !('cause' in error),
      ).toBe(true);
    });
  });

  it('rechecks the credential snapshot under a user lock before login session creation', async () => {
    const password = 'Synthetic login password';
    users.findByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'stored-hash',
      role: 'PARENT',
    });
    sessions.createInTransaction.mockResolvedValue({ id: 'session-id' });

    const result = await service.login(' USER@EXAMPLE.COM ', password);

    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
    const verifierCalls = (passwordHasher.verifyPassword as jest.Mock).mock
      .calls as unknown as Array<[string, string]>;
    expect(
      verifierCalls[0]?.[0] === password &&
        verifierCalls[0]?.[1] === 'stored-hash',
    ).toBe(true);
    expect(sessions.withUserLock).toHaveBeenCalledTimes(1);
    expect(lockedTx.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: { password: true },
    });
    expect(sessions.prepareRefreshTokenHash).toHaveBeenCalledTimes(1);
    expect(sessions.createInTransaction).toHaveBeenCalledWith(
      lockedTx,
      'user-id',
      'session-id',
      'prepared-refresh-hash',
      expect.any(Date),
    );
    expect(sessions.create).not.toHaveBeenCalled();
    expect(passwordHasher.hashPassword).not.toHaveBeenCalled();
    expect(jwt.sign).toHaveBeenCalledTimes(2);
    type SignMock = jest.MockedFunction<
      (
        payload: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => string
    >;
    const sign = jwt.sign as unknown as SignMock;
    expect(sign.mock.calls[0][0]).toEqual({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'PARENT',
      sid: 'session-id',
    });
    expect(sign.mock.calls[1][0]).toMatchObject(sign.mock.calls[0][0]);
    expect((sign.mock.calls[1][0] as { jti?: string }).jti).toBe('session-id');
    expect(sign.mock.calls[0][1]).toEqual({
      secret: 'secret',
      expiresIn: '15m',
    });
    expect(sign.mock.calls[1][1]).toEqual({
      secret: 'secret',
      expiresIn: '7d',
    });
    expect(result).toEqual({
      access_token: 'token',
      refresh_token: 'token',
      sid: 'session-id',
    });
  });

  it('rejects a stale credential snapshot without creating a usable session', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'verified-snapshot',
      role: 'PARENT',
    });
    lockedTx.user.findUnique.mockResolvedValue({
      password: 'changed-snapshot',
    });

    await expect(
      service.login('user@example.com', 'Synthetic login password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(sessions.withUserLock).toHaveBeenCalledTimes(1);
    expect(sessions.createInTransaction).not.toHaveBeenCalled();
  });

  it('uses the same verifier for legacy bcrypt and new scrypt snapshots without login rehash', async () => {
    for (const storedHash of [
      'legacy-bcrypt-encoding',
      'new-scrypt-v1-encoding',
    ]) {
      users.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        password: storedHash,
        role: 'PARENT',
      });
      lockedTx.user.findUnique.mockResolvedValue({ password: storedHash });
      sessions.createInTransaction.mockResolvedValue({ id: 'session-id' });

      const result = await service.login(
        'user@example.com',
        'Synthetic password',
      );

      expect(result.sid).toBe('session-id');
      expect(passwordHasher.hashPassword).not.toHaveBeenCalled();
    }

    expect(passwordHasher.verifyPassword).toHaveBeenCalledTimes(2);
  });

  it('rejects a missing sid or inactive session during refresh', async () => {
    jwt.verify.mockReturnValue({
      sub: 'user-id',
      email: 'a@b.com',
      role: 'PARENT',
    });
    await expect(service.refreshToken('legacy-token')).rejects.toThrow(
      UnauthorizedException,
    );

    jwt.verify.mockReturnValue({ sub: 'user-id', sid: 'revoked-session' });
    sessions.findActive.mockResolvedValue(null);
    await expect(service.refreshToken('revoked-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotates only the matching active session', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    sessions.findActive.mockResolvedValue({
      id: 'session-id',
      refreshTokenHash: 'hash',
      user: { id: 'user-id', email: 'new@example.com', role: 'PARENT' },
    });
    sessions.verifyRefreshToken.mockResolvedValue(true);
    sessions.rotate.mockResolvedValue({ id: 'session-id' });

    const result = await service.refreshToken('refresh-token');

    expect(sessions.findActive).toHaveBeenCalledWith('user-id', 'session-id');
    expect(sessions.rotate).toHaveBeenCalledWith(
      'session-id',
      'token',
      expect.any(Date),
    );
    expect(result.sid).toBe('session-id');
  });
});
