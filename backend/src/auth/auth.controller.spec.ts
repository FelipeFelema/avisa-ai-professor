import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: (authService = {
            login: jest.fn(),
            register: jest.fn(),
            refreshToken: jest.fn(),
          }),
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns only documented tokens while keeping sid internal to the JWT claim', async () => {
    authService.login.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      sid: 'session-id',
    });

    await expect(
      controller.login({ email: 'user@example.com', password: 'secret' }),
    ).resolves.toEqual({ access_token: 'access', refresh_token: 'refresh' });
  });

  it('returns only documented tokens after refresh', async () => {
    authService.refreshToken.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      sid: 'session-id',
    });

    await expect(
      controller.refresh({ refreshToken: 'refresh' }),
    ).resolves.toEqual({ access_token: 'access', refresh_token: 'refresh' });
  });

  it('documents login and refresh as 200 responses', () => {
    // Nest uses this metadata to override POST's default 201 status.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const loginHandler = AuthController.prototype.login;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const refreshHandler = AuthController.prototype.refresh;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, loginHandler)).toBe(200);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, refreshHandler)).toBe(200);
  });
});
