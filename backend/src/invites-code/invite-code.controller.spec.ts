import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { InviteCodeController } from './invite-code.controller';
import { InviteCodeService } from './invite-code.service';
import { ROLES_KEY } from '../auth/decorator/roles.decorator';
import { HEADERS_METADATA } from '@nestjs/common/constants';

describe('InviteCodeController', () => {
  it('keeps ADMIN guard metadata, operationId and no-store while deriving actor and sid from auth', async () => {
    const service = {
      createInviteCode: jest.fn().mockResolvedValue({ id: 'id' }),
    };
    const controller = new InviteCodeController(
      service as unknown as InviteCodeService,
    );
    const handler = Object.getOwnPropertyDescriptor(
      InviteCodeController.prototype,
      'create',
    )?.value as (...args: unknown[]) => unknown;
    expect(new Reflector().get(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
    expect(Reflect.getMetadata('swagger/apiOperation', handler)).toMatchObject({
      operationId: 'inviteCodes.create',
    });
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
      { name: 'Cache-Control', value: 'no-store' },
    ]);

    await controller.create(
      {
        user: { id: 'server-user', sid: 'server-session', role: Role.ADMIN },
      } as never,
      { role: 'PROFESSOR', userId: 'attacker', expiresInDays: 1 } as never,
    );
    expect(service.createInviteCode).toHaveBeenCalledWith(
      'server-user',
      'server-session',
    );
  });
});
