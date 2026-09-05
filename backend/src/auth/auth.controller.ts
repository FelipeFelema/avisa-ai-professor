import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
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

@Controller({
  path: 'auth',
  version: '1',
})
@ApiTags('auth')
@ApiExtraModels(LoginDto, CreateUserDto, RefreshTokenDto, AuthTokensResponseDto)
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(RateLimitGuard)
  @Post('login')
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
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @UseGuards(RateLimitGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'auth.register',
    summary: 'Cadastrar usuário',
    description:
      'Cria PARENT por padrão; um invite code válido cria PROFESSOR ou ADMIN. Limitado por IP.',
  })
  @ApiBody({ schema: { $ref: getSchemaPath(CreateUserDto) } })
  @ApiRegisterResponse('Usuário e sessão criados')
  @ApiValidationErrorResponse()
  @ApiConflictResponse()
  @ApiTooManyRequestsResponse()
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(RateLimitGuard, AuthGuard('jwt-refresh'))
  @Post('refresh')
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
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
