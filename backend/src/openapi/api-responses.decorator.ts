import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  AuthTokensResponseDto,
  RegisterResponseDto,
} from '../common/dto/auth-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

export type OpenApiSchemaReference = { $ref: string };

export function schemaRef(
  model: Type<unknown> | string,
): OpenApiSchemaReference {
  return { $ref: getSchemaPath(model) };
}

export function ApiResponseDto(
  status: number,
  model: Type<unknown>,
  description: string,
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: schemaRef(model),
    }),
  );
}

function ApiErrorResponse(status: number, description: string) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      schema: schemaRef(ErrorResponseDto),
    }),
  );
}

export function ApiValidationErrorResponse() {
  return ApiErrorResponse(400, 'Entrada inválida ou campo não permitido');
}

export function ApiUnauthorizedResponse() {
  return ApiErrorResponse(401, 'Credencial ausente, inválida ou expirada');
}

export function ApiForbiddenResponse() {
  return ApiErrorResponse(
    403,
    'Role, ownership, autoria ou membership insuficiente',
  );
}

export function ApiNotFoundResponse() {
  return ApiErrorResponse(404, 'Recurso inexistente ou não acessível');
}

export function ApiConflictResponse() {
  return ApiErrorResponse(409, 'Conflito de unicidade, limite ou lifecycle');
}

export function ApiTooManyRequestsResponse() {
  return ApiErrorResponse(429, 'Limite de requisições excedido');
}

export function ApiRegisterResponse(description = 'Usuário e sessão criados') {
  return applyDecorators(
    ApiExtraModels(RegisterResponseDto, AuthTokensResponseDto),
    ApiResponse({
      status: 201,
      description,
      schema: schemaRef(RegisterResponseDto),
    }),
  );
}
