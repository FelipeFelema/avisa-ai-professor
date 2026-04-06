import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { AuthUser } from 'src/common/types/auth-user.type';

@Controller({
  path: 'announcements',
  version: '1',
})
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Post()
  create(
    @Request() req: { user: AuthUser },
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(req.user.id, dto);
  }
}
