import {
  Request,
  Body,
  Controller,
  Post,
  UseGuards,
  Param,
  Get,
} from '@nestjs/common';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { AuthUser } from 'src/common/types/auth-user.type';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { ClassroomsService } from './classrooms.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';

@Controller({
  path: 'classrooms',
  version: '1',
})
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Post()
  create(@Request() req: { user: AuthUser }, @Body() dto: CreateClassroomDto) {
    return this.classroomsService.create(req.user.id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  join(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.classroomsService.join(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leave(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.classroomsService.leave(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMyClassrooms(@Request() req: { user: AuthUser }) {
    return this.classroomsService.findMyClassrooms(req.user.id);
  }
}
