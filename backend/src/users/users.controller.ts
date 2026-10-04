import {
  Controller,
  ConflictException,
  Get,
  Delete,
  HttpCode,
  Patch,
  Body,
  UseGuards,
  Request,
  Header,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  ApiResponse,
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
  ApiTooManyRequestsResponse,
  ApiValidationErrorResponse,
} from '../openapi/api-responses.decorator';
import { UserProfileDto } from '../common/dto/auth-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionImpactDto } from './dto/account-deletion-impact.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import type { Request as ExpressRequest } from 'express';

interface JwtRequest extends ExpressRequest {
  user: { id: string; email: string; role: string; sid: string };
}

@Controller({
  path: 'users',
  version: '1',
})
@ApiTags('users')
@ApiExtraModels(UpdateProfileDto, UserProfileDto, DeleteAccountDto)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  @Get('account-deletion')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'users.getAccountDeletionImpact',
    summary: 'Consultar o impacto da exclusão da própria conta',
    description:
      'Somente sub e sid da sessão validada. Sem corpo ou parâmetros; snapshot consistente de leitura, sem IDs ou total de ADMINs. O resumo não autoriza nem congela uma exclusão futura.',
  })
  @ApiResponseDto(
    200,
    AccountDeletionImpactDto,
    'Impacto atual, inclusive bloqueio da última ADMIN',
  )
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiExtraModels(ErrorResponseDto)
  @ApiResponse({
    status: 500,
    description: 'Não foi possível consultar o impacto da exclusão.',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getAccountDeletionImpact(@Request() req: JwtRequest) {
    if (Object.keys(req.query ?? {}).length || req.body !== undefined)
      throw new BadRequestException(
        'Esta consulta não aceita corpo ou parâmetros.',
      );
    try {
      return await this.accountDeletion.getImpact(req.user.id, req.user.sid);
    } catch (error) {
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      throw new InternalServerErrorException(
        'Não foi possível consultar o impacto da exclusão.',
      );
    }
  }

  @Delete('account')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'users.deleteOwnAccount',
    summary: 'Excluir permanentemente a própria conta',
    description:
      'Usa exclusivamente sub e sid atuais. Requer senha atual e a frase exata EXCLUIR MINHA CONTA. Uma única transação READ COMMITTED usa o gate ADMIN antes dos locks User/Classroom e remove o grafo vigente; não há receipt nem repetição automática. Responde somente após commit.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(DeleteAccountDto) } })
  @ApiResponse({
    status: 204,
    description: 'Exclusão integral confirmada após commit; resposta vazia.',
  })
  @ApiExtraModels(ErrorResponseDto)
  @ApiResponse({
    status: 400,
    description:
      'DTO inválido, CURRENT_PASSWORD_INVALID ou ACCOUNT_DELETION_CONFIRMATION_MISMATCH; sem escrita.',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiUnauthorizedResponse()
  @ApiResponse({
    status: 409,
    description: 'LAST_ADMIN_REQUIRED ou CREDENTIAL_CHANGED; sem escrita.',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiTooManyRequestsResponse()
  @ApiResponse({
    status: 500,
    description: 'Falha sanitizada; nenhum detalhe interno é exposto.',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async deleteOwnAccount(
    @Request() req: JwtRequest,
    @Body() deleteAccountDto: DeleteAccountDto,
  ): Promise<void> {
    if (Object.keys(req.query ?? {}).length)
      throw new BadRequestException(
        'Esta operaÃ§Ã£o nÃ£o aceita parÃ¢metros de seleÃ§Ã£o.',
      );
    try {
      await this.accountDeletion.deleteOwnAccount(
        req.user.id,
        req.user.sid,
        deleteAccountDto,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        [
          'CURRENT_PASSWORD_INVALID',
          'ACCOUNT_DELETION_CONFIRMATION_MISMATCH',
        ].includes(error.message)
      )
        throw error;
      if (error instanceof UnauthorizedException)
        throw new UnauthorizedException();
      if (
        error instanceof ConflictException &&
        ['LAST_ADMIN_REQUIRED', 'CREDENTIAL_CHANGED'].includes(error.message)
      )
        throw error;
      throw new InternalServerErrorException(
        'NÃ£o foi possÃ­vel excluir a conta.',
      );
    }
  }

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
