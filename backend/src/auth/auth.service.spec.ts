import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { InviteCodeService } from 'src/invites-code/invite-code.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  updateRefreshToken: jest.fn(),
  findByIdInternal: jest.fn(),
};

const mockInviteCodeService = {
  validateInviteCode: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: InviteCodeService, useValue: mockInviteCodeService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should validate user successfully', async () => {
      const userMock = {
        id: 'user-id',
        email: 'user@example.com',
        password: 'hashed',
        role: 'PARENT',
      };

      mockUsersService.findByEmail.mockResolvedValue(userMock);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'user@example.com',
        'password123',
      );

      expect(result).toEqual({
        id: 'user-id',
        email: 'user@example.com',
        role: 'PARENT',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );

      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed');
    });

    it('should throw UnauthorizedException if email does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('user@example.com', '123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUsersService.findByEmail).toHaveBeenCalledTimes(1);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        password: 'hashed',
        role: 'PARENT',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('user@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );

      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong', 'hashed');
    });
  });

  describe('login', () => {
    it('should login and return tokens', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        role: 'PARENT',
      });

      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '00000000-0000-0000-0000-000000000000',
      );

      mockJwtService.sign.mockReturnValue('token');
      mockConfigService.get.mockReturnValue('secret');

      const result = await service.login('user@example.com', '123');

      expect(result).toEqual({
        access_token: 'token',
        refresh_token: 'token',
      });

      expect(mockUsersService.updateRefreshToken).toHaveBeenCalled();

      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-id',
        'token',
        '00000000-0000-0000-0000-000000000000',
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        email: 'user@example.com',
        role: 'PARENT',
        tokenId: 'token-id',
      });

      mockUsersService.findByIdInternal.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        role: 'PARENT',
        refreshTokenHash: 'hash',
        refreshTokenId: 'token-id',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '00000000-0000-0000-0000-000000000000',
      );

      mockJwtService.sign.mockReturnValue('new-token');
      mockConfigService.get.mockReturnValue('secret');

      const result = await service.refreshToken('valid-token');

      expect(result).toEqual({
        access_token: 'new-token',
        refresh_token: 'new-token',
      });

      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-id',
        'new-token',
        '00000000-0000-0000-0000-000000000000',
      );
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error();
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        tokenId: 'token-id',
      });

      mockUsersService.findByIdInternal.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user has no refresh token stored', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        tokenId: 'token-id',
      });

      mockUsersService.findByIdInternal.mockResolvedValue({
        id: 'user-id',
        refreshTokenHash: null,
        refreshTokenId: null,
      });

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if tokenId does not match', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        tokenId: 'token-id',
      });

      mockUsersService.findByIdInternal.mockResolvedValue({
        id: 'user-id',
        refreshTokenHash: 'hash',
        refreshTokenId: 'different-id',
      });

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token hash does not match', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        tokenId: 'token-id',
      });

      mockUsersService.findByIdInternal.mockResolvedValue({
        id: 'user-id',
        refreshTokenHash: 'hash',
        refreshTokenId: 'token-id',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
