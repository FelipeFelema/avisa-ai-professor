import { Module } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { InviteCodeController } from './invite-code.controller';

@Module({
  providers: [InviteCodeService],
  exports: [InviteCodeService],
  controllers: [InviteCodeController],
})
export class InvitesCodeModule {}
