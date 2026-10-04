import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDeletionService } from './account-deletion.service';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  };
  const deletion = {
    getImpact: jest.fn(),
    deleteOwnAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: AccountDeletionService, useValue: deletion },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['PARENT', 'PROFESSOR', 'ADMIN'])(
    'uses only authenticated sub/sid for %s impact',
    async (role) => {
      await controller.getAccountDeletionImpact({
        user: { id: 'self', sid: 'live', role },
        query: {},
        body: undefined,
      } as never);
      expect(deletion.getImpact).toHaveBeenCalledWith('self', 'live');
    },
  );
  it.each([
    { query: { userId: 'other' } },
    { body: {} },
    { body: { role: 'ADMIN' } },
    { query: { anything: '' } },
  ])('rejects GET body/query selectors %#', async (extra) => {
    await expect(
      controller.getAccountDeletionImpact({
        user: { id: 'self', sid: 'live' },
        query: {},
        ...extra,
      } as never),
    ).rejects.toThrow('Esta consulta não aceita corpo ou parâmetros.');
    expect(deletion.getImpact).not.toHaveBeenCalled();
  });

  it.each(['PARENT', 'PROFESSOR', 'ADMIN'])(
    'deletes only authenticated %s sub/sid',
    async (role) => {
      const dto = {
        currentPassword: 'exact password',
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      };
      await controller.deleteOwnAccount(
        {
          user: {
            id: 'self',
            sid: 'live-session',
            role,
            email: 'untrusted-claim@example.com',
          },
          query: {},
        } as never,
        dto,
      );
      expect(deletion.deleteOwnAccount).toHaveBeenCalledWith(
        'self',
        'live-session',
        dto,
      );
    },
  );

  it.each([{ userId: 'other' }, { id: 'other' }, { anything: '' }])(
    'rejects DELETE query selectors %# before calling the service',
    async (query) => {
      await expect(
        controller.deleteOwnAccount(
          {
            user: { id: 'self', sid: 'live-session' },
            query,
          } as never,
          {
            currentPassword: 'exact password',
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        ),
      ).rejects.toThrow();
      expect(deletion.deleteOwnAccount).not.toHaveBeenCalled();
    },
  );

  it('exposes the destructive endpoint with rate limiting, JWT, no-store and empty 204', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      UsersController.prototype,
      'deleteOwnAccount',
    )?.value;
    if (typeof handler !== 'function')
      throw new Error('The account DELETE handler is not defined.');
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('account');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.DELETE,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      RateLimitGuard,
      JwtAuthGuard,
    ]);
  });

  it('uses the existing 429 rate-limit response for repeated destructive requests', () => {
    const guard = new RateLimitGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: 'account-deletion-controller-test' }),
      }),
    } as never;
    for (let index = 0; index < 10; index += 1)
      expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
      throw new Error('The existing rate limit should block request eleven.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it.each(['PARENT', 'PROFESSOR', 'ADMIN'])(
    'uses the authenticated sub and sid for a %s profile update',
    async (role) => {
      const request = {
        user: {
          id: 'authenticated-user-id',
          email: 'stale@example.com',
          role,
          sid: 'current-session-id',
        },
      };
      const updateProfileDto = { name: 'Updated Name' };

      await controller.updateProfile(request as never, updateProfileDto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'authenticated-user-id',
        'current-session-id',
        updateProfileDto,
      );
    },
  );
});
