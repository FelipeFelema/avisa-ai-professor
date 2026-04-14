import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { CreateInviteCodeDto } from './dto/create-invite-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';

@Controller({
  path: 'invite-codes',
  version: '1',
})
export class InviteCodeController {
  constructor(private readonly inviteCodeService: InviteCodeService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateInviteCodeDto) {
    return this.inviteCodeService.createInviteCode(dto.role, dto.expiresInDays);
  }
}
