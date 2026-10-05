import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InviteCodeService } from './invite-code.service';
import {
  CreateInviteCodeDto,
  InviteCodeResponseDto,
} from './dto/create-invite-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  ApiForbiddenResponse,
  ApiResponseDto,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
  schemaRef,
} from '../openapi/api-responses.decorator';

type AuthenticatedRequest = Request & {
  user: { id: string; sid: string; role: Role };
};

@Controller({
  path: 'invite-codes',
  version: '1',
})
@ApiTags('invite-codes')
@ApiBearerAuth('bearerAuth')
@ApiExtraModels(CreateInviteCodeDto, InviteCodeResponseDto)
export class InviteCodeController {
  constructor(private readonly inviteCodeService: InviteCodeService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'inviteCodes.create',
    summary: 'Criar código de convite',
    description:
      'Requer sessão ativa e papel ADMIN atual. Emite apenas convites PROFESSOR válidos por sete dias. Resposta sem cache; códigos reais nunca aparecem nos exemplos da documentação.',
  })
  @ApiBody({ schema: schemaRef(CreateInviteCodeDto) })
  @ApiResponse({
    status: 201,
    headers: {
      'Cache-Control': { schema: { type: 'string' }, description: 'no-store' },
    },
  })
  @ApiResponseDto(201, InviteCodeResponseDto, 'Código criado')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiResponseDto(
    503,
    ErrorResponseDto,
    'Colisões esgotadas; emissão não confirmada para o cliente',
  )
  @ApiResponseDto(500, ErrorResponseDto, 'Falha interna sanitizada')
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateInviteCodeDto) {
    void dto;
    return this.inviteCodeService.createInviteCode(req.user.id, req.user.sid);
  }
}
