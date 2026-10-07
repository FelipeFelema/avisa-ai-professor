import type { Request, Response } from 'express';
import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { InstallationCapabilityGuard } from './guards/installation-capability.guard';
import { ActivatePushDto } from './dto/activate-push.dto';
import { EmptyPushDto } from './dto/empty-push.dto';
import {
  PushInstallationViewDto,
  PushBindingViewDto,
  PushTestAcceptedDto,
} from './dto/push-view.dto';
import { RevokePushDto } from './dto/revoke-push.dto';
import {
  assertNoPushQuery,
  assertStrictEmptyPushBody,
} from './dto/push-request.validation';
import { PushRegistrationService } from './push-registration.service';
import {
  PushTestRateLimitException,
  PushTestService,
} from './push-test.service';

type AuthenticatedPushRequest = Request & {
  user: { id: string; sid: string };
};

function readPushProof(request: Request): {
  installationId: string;
  capability: string;
} {
  return {
    installationId: request.header('x-push-installation') ?? '',
    capability: request.header('x-push-capability') ?? '',
  };
}

function ApiPushErrorResponse(status: number, description: string) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      headers: {
        'Cache-Control': {
          description: 'no-store',
          schema: { type: 'string' },
        },
      },
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    }),
  );
}

@Controller({ path: 'push', version: '1' })
@ApiTags('push')
@ApiExtraModels(
  EmptyPushDto,
  ActivatePushDto,
  RevokePushDto,
  PushBindingViewDto,
  PushInstallationViewDto,
  PushTestAcceptedDto,
  ErrorResponseDto,
)
export class PushController {
  constructor(
    private readonly registrations: PushRegistrationService,
    private readonly tests: PushTestService,
  ) {}

  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @Post('installation/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'push.reserveInstallation',
    summary: 'Reservar vínculo para esta instalação',
    description:
      'Cria uma instalação apenas após intenção autenticada. A reserva não contém token e não é elegível para envio.',
  })
  @ApiExtension('x-max-request-bytes', 2048)
  @ApiHeader({
    name: 'X-Push-Installation',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({
    name: 'X-Push-Capability',
    required: true,
    description: 'Capability privada base64url de 32 bytes.',
    schema: { type: 'string' },
  })
  @ApiBody({ schema: { $ref: '#/components/schemas/EmptyPushRequest' } })
  @ApiResponse({
    status: 200,
    description: 'Vínculo RESERVED ou ACTIVE da sessão atual.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
    },
    schema: { $ref: '#/components/schemas/PushBindingView' },
  })
  @ApiPushErrorResponse(400, 'Entrada inválida ou campo não permitido')
  @ApiPushErrorResponse(401, 'Credencial ausente, inválida ou expirada')
  @ApiPushErrorResponse(
    403,
    'Role, ownership, autoria ou membership insuficiente',
  )
  @ApiPushErrorResponse(409, 'Conflito de unicidade, limite ou lifecycle')
  @ApiPushErrorResponse(429, 'Limite de requisições excedido')
  async reserve(
    @Req() request: AuthenticatedPushRequest,
    @Body() body: unknown,
  ) {
    assertNoPushQuery(request.query);
    assertStrictEmptyPushBody(body, EmptyPushDto);
    return this.registrations.reserve(
      { userId: request.user.id, sessionId: request.user.sid },
      readPushProof(request),
    );
  }

  @UseGuards(RateLimitGuard, JwtAuthGuard, InstallationCapabilityGuard)
  @Get('installation')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'push.getInstallation',
    summary: 'Consultar estado do vínculo desta instalação',
    description:
      'Retorna somente o estado pertencente à conta e sessão autenticadas, sem devolver token ou identidade de outro vínculo.',
  })
  @ApiExtension('x-max-request-bytes', 2048)
  @ApiHeader({
    name: 'X-Push-Installation',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({
    name: 'X-Push-Capability',
    required: true,
    description: 'Capability privada base64url de 32 bytes.',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Estado atual do vínculo desta instalação.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
    },
    schema: { $ref: '#/components/schemas/PushInstallationView' },
  })
  @ApiPushErrorResponse(400, 'Entrada inválida ou campo não permitido')
  @ApiPushErrorResponse(401, 'Credencial ausente, inválida ou expirada')
  @ApiPushErrorResponse(
    403,
    'Role, ownership, autoria ou membership insuficiente',
  )
  @ApiPushErrorResponse(429, 'Limite de requisições excedido')
  async state(@Req() request: AuthenticatedPushRequest) {
    assertNoPushQuery(request.query);
    return this.registrations.getState(
      { userId: request.user.id, sessionId: request.user.sid },
      readPushProof(request),
    );
  }

  @UseGuards(RateLimitGuard, JwtAuthGuard, InstallationCapabilityGuard)
  @Put('installation')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'push.activateInstallation',
    summary: 'Ativar ou atualizar o token Expo deste vínculo',
    description:
      'Nenhum envio ao provedor ocorre neste endpoint. Token é recebido somente no corpo e não aparece em respostas. expectedTokenRevision aplica compare-and-swap; mudança de token/plataforma incrementa a revisão, retry idempotente preserva a revisão, e vínculos REVOKED/INVALID exigem nova reserva.',
  })
  @ApiExtension('x-max-request-bytes', 2048)
  @ApiHeader({
    name: 'X-Push-Installation',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({
    name: 'X-Push-Capability',
    required: true,
    description: 'Capability privada base64url de 32 bytes.',
    schema: { type: 'string' },
  })
  @ApiBody({ type: ActivatePushDto })
  @ApiResponse({
    status: 200,
    description: 'Vínculo ativado ou atualizado.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
    },
    schema: { $ref: '#/components/schemas/PushBindingView' },
  })
  @ApiPushErrorResponse(400, 'Entrada inválida ou campo não permitido')
  @ApiPushErrorResponse(401, 'Credencial ausente, inválida ou expirada')
  @ApiPushErrorResponse(
    403,
    'Role, ownership, autoria ou membership insuficiente',
  )
  @ApiPushErrorResponse(409, 'Conflito de unicidade, limite ou lifecycle')
  @ApiPushErrorResponse(429, 'Limite de requisições excedido')
  async activate(
    @Req() request: AuthenticatedPushRequest,
    @Body() body: unknown,
  ) {
    assertNoPushQuery(request.query);
    return this.registrations.activate(
      { userId: request.user.id, sessionId: request.user.sid },
      readPushProof(request),
      body,
    );
  }

  @UseGuards(RateLimitGuard, JwtAuthGuard, InstallationCapabilityGuard)
  @Post('installation/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'push.testInstallation',
    summary: 'Enviar uma notificação neutra de teste para esta instalação',
    description:
      'Envia somente após revalidar a sessão e o vínculo corrente. 202 confirma o aceite do ticket pelo provedor, não a exibição no dispositivo. Timeout ou resultado ambíguo não é reenviado automaticamente.',
  })
  @ApiExtension('x-max-request-bytes', 2048)
  @ApiHeader({
    name: 'X-Push-Installation',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({
    name: 'X-Push-Capability',
    required: true,
    description: 'Capability privada base64url de 32 bytes.',
    schema: { type: 'string' },
  })
  @ApiBody({ schema: { $ref: '#/components/schemas/EmptyPushRequest' } })
  @ApiResponse({
    status: 202,
    description: 'Ticket aceito pelo provedor para uma mensagem neutra.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
    },
    schema: { $ref: '#/components/schemas/PushTestAccepted' },
  })
  @ApiPushErrorResponse(400, 'Entrada inválida ou campo não permitido')
  @ApiPushErrorResponse(401, 'Credencial ausente, inválida ou expirada')
  @ApiPushErrorResponse(403, 'Capability inválida')
  @ApiPushErrorResponse(409, 'Vínculo inativo ou tentativa em andamento')
  @ApiResponse({
    status: 429,
    description: 'Cooldown persistido da instalação.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
      'Retry-After': {
        description: 'Segundos até uma nova intenção ser permitida.',
        schema: { type: 'integer', minimum: 1 },
      },
    },
    schema: { $ref: '#/components/schemas/ErrorResponse' },
  })
  @ApiPushErrorResponse(503, 'Configuração indisponível ou resultado ambíguo')
  async test(
    @Req() request: AuthenticatedPushRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertNoPushQuery(request.query);
    assertStrictEmptyPushBody(body, EmptyPushDto);
    response.setHeader('Cache-Control', 'no-store');
    try {
      return await this.tests.sendTest(
        { userId: request.user.id, sessionId: request.user.sid },
        readPushProof(request),
      );
    } catch (error) {
      if (error instanceof PushTestRateLimitException) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }

  @UseGuards(RateLimitGuard)
  @Delete('installation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'push.revokeInstallation',
    summary: 'Revogar vínculo usando somente a capability da instalação',
    description:
      'Não exige JWT para permitir cleanup após logout. A capability concede apenas revogação do binding informado.',
  })
  @ApiExtension('x-max-request-bytes', 2048)
  @ApiHeader({
    name: 'X-Push-Installation',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiHeader({
    name: 'X-Push-Capability',
    required: true,
    description: 'Capability privada base64url de 32 bytes.',
    schema: { type: 'string' },
  })
  @ApiBody({ type: RevokePushDto })
  @ApiResponse({
    status: 204,
    description: 'Revogado ou operação idempotente sem vínculo.',
    headers: {
      'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
    },
  })
  @ApiPushErrorResponse(400, 'Entrada inválida ou campo não permitido')
  @ApiPushErrorResponse(
    403,
    'Role, ownership, autoria ou membership insuficiente',
  )
  @ApiPushErrorResponse(429, 'Limite de requisições excedido')
  async revoke(
    @Req() request: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertNoPushQuery(request.query);
    await this.registrations.revoke(readPushProof(request), body);
    response.status(HttpStatus.NO_CONTENT);
  }
}
