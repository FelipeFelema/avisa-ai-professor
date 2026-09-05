import {
  Request,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Param,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import {
  ClassroomMemberDto,
  ClassroomSummaryDto,
  ClassroomWithMembersDto,
  LastAnnouncementSummaryDto,
  TeacherSummaryDto,
} from './dto/classroom-summary.dto';
import { ClassroomsService } from './classrooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiResponseDto,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
  schemaRef,
} from '../openapi/api-responses.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('classrooms')
@ApiBearerAuth('bearerAuth')
@ApiExtraModels(
  ClassroomSummaryDto,
  ClassroomWithMembersDto,
  ClassroomMemberDto,
  TeacherSummaryDto,
  LastAnnouncementSummaryDto,
  CreateClassroomDto,
)
@Controller({
  path: 'classrooms',
  version: '1',
})
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Post()
  @ApiOperation({
    operationId: 'classrooms.create',
    summary: 'Criar turma',
    description: 'Requer role PROFESSOR; o criador se torna owner e membro.',
  })
  @ApiBody({ type: CreateClassroomDto })
  @ApiResponseDto(201, ClassroomWithMembersDto, 'Turma criada')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse()
  create(@Request() req: { user: AuthUser }, @Body() dto: CreateClassroomDto) {
    return this.classroomsService.create(req.user.id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  @ApiOperation({
    operationId: 'classrooms.join',
    summary: 'Entrar em uma turma',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID da turma',
  })
  @ApiResponseDto(201, ClassroomWithMembersDto, 'Membership criada')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  join(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.classroomsService.join(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  @ApiOperation({
    operationId: 'classrooms.leave',
    summary: 'Sair de uma turma',
    description:
      'Permitido somente a membro não-owner. O owner deve excluir a turma.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID da turma',
  })
  @ApiResponseDto(200, ClassroomWithMembersDto, 'Membership removida')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  leave(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.classroomsService.leave(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiOperation({
    operationId: 'classrooms.findMine',
    summary: 'Listar minhas turmas',
    description:
      'Retorna ownerId explícito para decisões de apresentação; a API continua autoridade de acesso.',
  })
  @ApiResponse({
    status: 200,
    description: 'Turmas das quais o usuário participa',
    schema: {
      type: 'array',
      items: schemaRef(ClassroomSummaryDto),
    },
  })
  @ApiUnauthorizedResponse()
  findMyClassrooms(@Request() req: { user: AuthUser }) {
    return this.classroomsService.findMyClassrooms(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    operationId: 'classrooms.findAvailable',
    summary: 'Listar turmas disponíveis',
    description: 'Exclui turmas das quais o usuário já participa.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: 'string',
    maxLength: 80,
    description: 'Filtro case-insensitive pelo nome',
  })
  @ApiResponse({
    status: 200,
    description: 'Turmas disponíveis',
    schema: {
      type: 'array',
      items: schemaRef(ClassroomSummaryDto),
    },
  })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  findAvailable(
    @Request() req: { user: AuthUser },
    @Query('search') search?: string,
  ) {
    return this.classroomsService.findAvailableClassrooms(req.user.id, search);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSOR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'classrooms.delete',
    summary: 'Excluir turma própria',
    description:
      'Requer PROFESSOR owner. A primeira exclusão remove permanentemente memberships e announcements por cascata PostgreSQL e registra um receipt mínimo. Uma repetição reconhecida do mesmo owner também retorna 204 sem novo efeito.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID da turma',
  })
  @ApiResponse({
    status: 204,
    description:
      'Turma e dependências excluídas permanentemente, ou repetição reconhecida do mesmo owner já concluída; resposta sem corpo',
  })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiExtraModels(ErrorResponseDto)
  @ApiResponse({
    status: 404,
    description:
      'Turma ausente sem receipt de exclusão correspondente ao usuário atual',
    schema: schemaRef(ErrorResponseDto),
  })
  delete(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.classroomsService.delete(req.user.id, id);
  }
}
