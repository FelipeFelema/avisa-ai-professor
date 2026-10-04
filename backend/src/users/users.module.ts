import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { InvitesCodeModule } from '../invites-code/invites-code.module';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [InvitesCodeModule],
  providers: [UsersService, AccountDeletionService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Run before guards so invalid/expired sessions also receive no-store.
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes(
        {
          path: 'users/account-deletion',
          method: RequestMethod.GET,
          version: '1',
        },
        {
          path: 'users/account',
          method: RequestMethod.DELETE,
          version: '1',
        },
      );
  }
}
