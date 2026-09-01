import { Test, TestingModule } from '@nestjs/testing';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

describe('ClassroomsController', () => {
  let controller: ClassroomsController;
  let classroomsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassroomsController],
      providers: [
        {
          provide: ClassroomsService,
          useValue: (classroomsService = {
            create: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
            findMyClassrooms: jest.fn(),
            delete: jest.fn(),
          }),
        },
      ],
    }).compile();

    controller = module.get<ClassroomsController>(ClassroomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the authenticated user id explicitly to owner authorization', async () => {
    classroomsService.delete.mockResolvedValue(undefined);

    await controller.delete('classroom-id', {
      user: { id: 'owner-id' } as never,
    });

    expect(classroomsService.delete).toHaveBeenCalledWith(
      'owner-id',
      'classroom-id',
    );
  });

  it('should expose the classroom DELETE endpoint as an empty 204 response', () => {
    // Decorator metadata is stored on the handler function by Nest.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const deleteHandler = ClassroomsController.prototype.delete;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, deleteHandler)).toBe(204);
  });
});
