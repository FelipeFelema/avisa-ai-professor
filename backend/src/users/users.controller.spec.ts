import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
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
