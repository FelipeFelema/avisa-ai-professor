import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Header,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { RateLimitGuard } from './guards/rate-limit.guard';
import {
  ApiConflictResponse,
  ApiRegisterResponse,
  ApiResponseDto,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
} from '../openapi/api-responses.decorator';
import { AuthTokensResponseDto } from '../common/dto/auth-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface PasswordRequest extends Express.Request {
  user: { id: string; sid: string };
}

@Controller({
  path: 'auth',
  version: '1',
})
@ApiTags('auth')
@ApiExtraModels(
  LoginDto,
  CreateUserDto,
  RefreshTokenDto,
  AuthTokensResponseDto,
  ChangePasswordDto,
  ErrorResponseDto,
)
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'auth.changePassword',
    summary: 'Alterar a própria senha',
    description:
      'Usa user/sid autenticados. Valida strings exatas, nova senha de 6–72 pontos de código Unicode e confirmação. Grava credencial e revoga outras sessões atomicamente; os tokens iniciadores permanecem válidos. Limitado por IP.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(ChangePasswordDto) } })
  @ApiResponse({
    status: 204,
    description: 'Senha alterada; sem corpo ou tokens novos',
  })
  @ApiResponseDto(
    400,
    ErrorResponseDto,
    'Entrada inválida; CURRENT_PASSWORD_INVALID, PASSWORD_UNCHANGED ou PASSWORD_CONFIRMATION_MISMATCH',
  )
  @ApiUnauthorizedResponse()
  @ApiResponseDto(
    409,
    ErrorResponseDto,
    'CREDENTIAL_CHANGED; revise e reentre os dados',
  )
  @ApiTooManyRequestsResponse()
  @ApiResponseDto(
    500,
    ErrorResponseDto,
    'Falha interna sanitizada; transação revertida',
  )
  async changePassword(
    @Request() req: PasswordRequest,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(req.user.id, req.user.sid, body);
  }

  @UseGuards(RateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'auth.login',
    summary: 'Entrar com e-mail e senha',
    description: 'Normaliza o e-mail e cria um par JWT. Limitado por IP.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(LoginDto) } })
  @ApiResponseDto(200, AuthTokensResponseDto, 'Sessão criada')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiTooManyRequestsResponse()
  async login(@Body() loginDto: LoginDto) {
    const tokens = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  @UseGuards(RateLimitGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'auth.register',
    summary: 'Cadastrar usuário',
    description:
      'Cria PARENT por padrão; somente convite PROFESSOR válido cria PROFESSOR. ADMIN não pode ser provisionado pelo cadastro público. Convite inválido, expirado, usado ou de outro papel retorna erro genérico. Resposta sem cache. Limitado por IP.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(CreateUserDto) } })
  @ApiRegisterResponse('Usuário e sessão criados')
  @ApiResponse({
    status: 201,
    headers: {
      'Cache-Control': { schema: { type: 'string' }, description: 'no-store' },
    },
  })
  @ApiValidationErrorResponse()
  @ApiConflictResponse()
  @ApiResponseDto(
    400,
    ErrorResponseDto,
    'Código de convite inválido ou indisponível.',
  )
  @ApiTooManyRequestsResponse()
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(RateLimitGuard, AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'auth.refresh',
    summary: 'Renovar tokens JWT',
    description:
      'Valida o refresh token rotativo e emite claims usando os dados atuais do usuário. Limitado por IP.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(RefreshTokenDto) } })
  @ApiResponseDto(200, AuthTokensResponseDto, 'Tokens renovados')
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiTooManyRequestsResponse()
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }
}
