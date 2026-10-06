import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

const INVALID_PUSH_REQUEST = 'PUSH_INVALID_REQUEST';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validatePushDto<T extends object>(
  value: unknown,
  dtoType: ClassConstructor<T>,
): T {
  if (!isPlainRecord(value)) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }

  const dto = plainToInstance(dtoType, value, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }

  return dto;
}

export function assertStrictEmptyPushBody<T extends object>(
  body: unknown,
  dtoType: ClassConstructor<T>,
): T {
  if (!isPlainRecord(body) || Object.keys(body).length !== 0) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }

  return validatePushDto(body, dtoType);
}

export function assertNoPushQuery(query: unknown): void {
  if (query === undefined || query === null) {
    return;
  }

  if (!isPlainRecord(query) || Object.keys(query).length > 0) {
    throw new BadRequestException(INVALID_PUSH_REQUEST);
  }
}
