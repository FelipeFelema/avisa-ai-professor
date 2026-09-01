import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('crypto', () => ({ randomUUID: jest.fn(() => 'session-id') }));

const users = {
  findByEmail: jest.fn(),
  createUser: jest.fn(),
};
const sessions = {
  create: jest.fn(),
  findActive: jest.fn(),
  verifyRefreshToken: jest.fn(),
  rotate: jest.fn(),
};
const jwt = { sign: jest.fn(() => 'token'), verify: jest.fn() };
const config = { getOrThrow: jest.fn(() => 'secret') };

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
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it('creates a distinct session and puts the same sid in access and refresh JWTs', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'hash',
      role: 'PARENT',
    });
    sessions.create.mockResolvedValue({ id: 'session-id' });

    const result = await service.login(' USER@EXAMPLE.COM ', 'password');

    expect(users.findByEmail).toHaveBeenCalledWith('user@example.com');
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
    expect(sessions.create).toHaveBeenCalledWith(
      'user-id',
      'session-id',
      'token',
      expect.any(Date),
    );
    expect(result).toEqual({
      access_token: 'token',
      refresh_token: 'token',
      sid: 'session-id',
    });
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
