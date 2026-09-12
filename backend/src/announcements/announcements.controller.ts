import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import {
  AnnouncementAuthorDto,
  AnnouncementDto,
  CreateAnnouncementDto,
} from './dto/create-announcement.dto';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiResponseDto,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
  schemaRef,
} from '../openapi/api-responses.decorator';

@Controller({
  path: 'announcements',
  version: '1',
})
@ApiTags('announcements')
@ApiBearerAuth('bearerAuth')
@ApiExtraModels(
  AnnouncementAuthorDto,
  AnnouncementDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
)
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    operationId: 'announcements.findAll',
    summary: 'Listar comunicados ativos acessíveis',
  })
  @ApiResponse({
    status: 200,
    description: 'Comunicados ativos das turmas do usuário',
    schema: {
      type: 'array',
      items: schemaRef(AnnouncementDto),
    },
  })
  @ApiUnauthorizedResponse()
  findAll(@Request() req: { user: AuthUser }) {
    return this.announcementsService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('classrooms/:classroomId')
  @ApiOperation({
    operationId: 'announcements.findByClassroom',
    summary: 'Listar comunicados ativos de uma turma',
    description: 'Requer membership na turma.',
  })
  @ApiParam({
    name: 'classroomId',
    type: 'string',
    format: 'uuid',
    description: 'ID da turma',
  })
  @ApiResponse({
    status: 200,
    description: 'Comunicados ativos da turma',
    schema: {
      type: 'array',
      items: schemaRef(AnnouncementDto),
    },
  })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  findByClassroom(
    @Request() req: { user: AuthUser },
    @Param('classroomId') classroomId: string,
  ) {
    return this.announcementsService.findByClassroom(req.user.id, classroomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    operationId: 'announcements.findOne',
    summary: 'Obter um comunicado ativo',
    description: 'Requer membership na turma.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID do comunicado',
  })
  @ApiResponseDto(200, AnnouncementDto, 'Comunicado')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.announcementsService.findOneById(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Post()
  @ApiOperation({
    operationId: 'announcements.create',
    summary: 'Criar comunicado',
    description:
      'Requer PROFESSOR membro da turma e respeita o limite de comunicados ativos.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(CreateAnnouncementDto) } })
  @ApiResponseDto(201, AnnouncementDto, 'Comunicado criado')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  create(
    @Request() req: { user: AuthUser },
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Patch(':id')
  @ApiOperation({
    operationId: 'announcements.update',
    summary: 'Atualizar comunicado próprio',
    description:
      'Requer PROFESSOR autor, membro da turma e comunicado não expirado.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID do comunicado',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(UpdateAnnouncementDto) } })
  @ApiResponseDto(200, AnnouncementDto, 'Comunicado atualizado')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'announcements.delete',
    summary: 'Excluir comunicado próprio',
    description: 'Requer PROFESSOR autor e membro da turma.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID do comunicado',
  })
  @ApiResponse({ status: 204, description: 'Comunicado excluído' })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  remove(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.announcementsService.delete(req.user.id, id);
  }
}
