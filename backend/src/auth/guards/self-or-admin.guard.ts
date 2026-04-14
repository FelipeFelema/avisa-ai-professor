import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthUser;
      params: { id: string };
    }>();
    const user = request.user;
    const userId = request.params.id;

    if (!user) {
      throw new ForbiddenException('Acesso negado');
    }

    if (user.role === Role.ADMIN || user.id === userId) {
      return true;
    }

    throw new ForbiddenException('Acesso negado');
  }
}
