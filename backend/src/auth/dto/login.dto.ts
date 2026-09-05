import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

import { transformUserEmail } from '../../common/normalizers/user-normalizer';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'LoginRequest',
  additionalProperties: false,
})
export class LoginDto {
  @ApiProperty({
    type: 'string',
    format: 'email',
    maxLength: 255,
  })
  @Transform(({ value }) => transformUserEmail(value as unknown))
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail não pode estar vazio' })
  email!: string;

  @ApiProperty({
    type: 'string',
    minLength: 6,
    writeOnly: true,
  })
  @IsString({ message: 'A senha deve ser uma string' })
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;
}

@closedSchema({
  name: 'RefreshTokenRequest',
  additionalProperties: false,
})
export class RefreshTokenDto {
  @ApiProperty({
    type: 'string',
    minLength: 1,
    writeOnly: true,
  })
  @IsString({ message: 'O refresh token deve ser uma string' })
  @IsNotEmpty({ message: 'O refresh token não pode estar vazio' })
  refreshToken!: string;
}
