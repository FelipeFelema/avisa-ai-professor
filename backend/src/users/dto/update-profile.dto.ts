import { Transform } from 'class-transformer';
import {
  ApiPropertyOptional,
  ApiSchema,
  ApiSchemaOptions,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  transformUserEmail,
  transformUserName,
  USER_NAME_PATTERN,
} from '../../common/normalizers/user-normalizer';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
  minProperties?: number;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

const USER_NAME_API_PATTERN = "^[A-Za-zÀ-ÿ\\s'-]+$";

@closedSchema({
  name: 'UpdateProfileRequest',
  additionalProperties: false,
  minProperties: 1,
})
export class UpdateProfileDto {
  @ApiPropertyOptional({
    type: 'string',
    minLength: 3,
    maxLength: 100,
    pattern: USER_NAME_API_PATTERN,
  })
  @Transform(({ value }) => transformUserName(value as unknown))
  @ValidateIf((object: unknown) => {
    const profile = object as { name?: unknown; email?: unknown };
    return profile.name !== undefined || profile.email === undefined;
  })
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  @Matches(USER_NAME_PATTERN, {
    message: 'O nome deve conter apenas letras, espaços, hífen e apóstrofo',
  })
  name?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'email',
    maxLength: 255,
  })
  @Transform(({ value }) => transformUserEmail(value as unknown))
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(255, { message: 'O e-mail deve ter no máximo 255 caracteres' })
  email?: string;
}
