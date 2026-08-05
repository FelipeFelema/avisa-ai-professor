import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';

@Controller({
  path: 'announcements',
  version: '1',
})
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: { user: AuthUser }) {
    return this.announcementsService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('classrooms/:classroomId')
  findByClassroom(
    @Request() req: { user: AuthUser },
    @Param('classroomId') classroomId: string,
  ) {
    return this.announcementsService.findByClassroom(req.user.id, classroomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.announcementsService.findOneById(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Post()
  create(
    @Request() req: { user: AuthUser },
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.announcementsService.delete(req.user.id, id);
  }
}
