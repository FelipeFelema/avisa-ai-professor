import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
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
import {
  ApiForbiddenResponse,
  ApiResponseDto,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
  schemaRef,
} from '../openapi/api-responses.decorator';

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
  @ApiOperation({
    operationId: 'inviteCodes.create',
    summary: 'Criar código de convite',
    description:
      'Requer role ADMIN. Códigos reais nunca aparecem nos exemplos da documentação.',
  })
  @ApiBody({ schema: schemaRef(CreateInviteCodeDto) })
  @ApiResponseDto(201, InviteCodeResponseDto, 'Código criado')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(@Body() dto: CreateInviteCodeDto) {
    return this.inviteCodeService.createInviteCode(dto.role, dto.expiresInDays);
  }
}
