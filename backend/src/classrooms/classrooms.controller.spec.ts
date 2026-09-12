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

  it.each(['create', 'join', 'leave'])(
    'maps %s responses to the documented members shape',
    async (operation) => {
      const classroom = {
        id: 'classroom-id',
        name: '1Â° ANO A',
        ownerId: 'owner-id',
        createdAt: new Date('2026-09-09T10:00:00.000Z'),
        updatedAt: new Date('2026-09-09T10:00:00.000Z'),
        userClassrooms: [{ user: { id: 'owner-id', name: 'Professor Test' } }],
      };
      classroomsService[operation].mockResolvedValue(classroom);

      const result =
        operation === 'create'
          ? await controller.create(
              { user: { id: 'owner-id' } } as never,
              { name: classroom.name } as never,
            )
          : operation === 'join'
            ? await controller.join('classroom-id', {
                user: { id: 'parent-id' },
              } as never)
            : await controller.leave('classroom-id', {
                user: { id: 'parent-id' },
              } as never);

      expect(result).toEqual({
        id: classroom.id,
        name: classroom.name,
        ownerId: classroom.ownerId,
        members: classroom.userClassrooms.map(({ user }) => user),
        createdAt: classroom.createdAt,
        updatedAt: classroom.updatedAt,
      });
      expect(result).not.toHaveProperty('userClassrooms');
    },
  );

  it('should expose the classroom DELETE endpoint as an empty 204 response', () => {
    // Decorator metadata is stored on the handler function by Nest.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const deleteHandler = ClassroomsController.prototype.delete;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, deleteHandler)).toBe(204);
  });

  it('exposes the classroom leave endpoint as a 200 response', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const leaveHandler = ClassroomsController.prototype.leave;

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, leaveHandler)).toBe(200);
  });
});
