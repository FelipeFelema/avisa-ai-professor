import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiResponseDto,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
} from '../openapi/api-responses.decorator';
import { UserProfileDto } from '../common/dto/auth-response.dto';

interface JwtRequest extends Express.Request {
  user: { id: string; email: string; role: string; sid: string };
}

@Controller({
  path: 'users',
  version: '1',
})
@ApiTags('users')
@ApiExtraModels(UpdateProfileDto, UserProfileDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'users.getProfile',
    summary: 'Obter o próprio perfil',
  })
  @ApiResponseDto(200, UserProfileDto, 'Perfil público atual')
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async getProfile(@Request() req: JwtRequest) {
    return await this.usersService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'users.updateProfile',
    summary: 'Atualizar o próprio nome e/ou e-mail',
    description:
      'Usa exclusivamente sub e sid da sessão JWT validada. Password, role, id e campos desconhecidos são rejeitados. Uma troca efetiva de e-mail mantém o sid atual e revoga todas as outras sessões do usuário; name-only e no-op não revogam sessões.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(UpdateProfileDto) } })
  @ApiResponseDto(
    200,
    UserProfileDto,
    'Perfil público atualizado ou perfil atual em no-op normalizado; a sessão atual permanece autenticada',
  )
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiConflictResponse()
  async updateProfile(
    @Request() req: JwtRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return await this.usersService.updateProfile(
      req.user.id,
      req.user.sid,
      updateProfileDto,
    );
  }
}
