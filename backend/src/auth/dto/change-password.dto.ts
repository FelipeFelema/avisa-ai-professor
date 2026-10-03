import { Transform } from 'class-transformer';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateBy } from 'class-validator';

const closedOptions: ApiSchemaOptions & { additionalProperties: false } = {
  name: 'ChangePasswordRequest',
  additionalProperties: false,
};

// Restore the original JSON type after the installed implicit conversion.
const rawValue = () =>
  Transform(
    ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key],
  );

@ApiSchema(closedOptions)
export class ChangePasswordDto {
  @ApiProperty({
    type: 'string',
    minLength: 1,
    writeOnly: true,
    description:
      'Senha atual não vazia, preservada integralmente; sem máximo novo.',
  })
  @rawValue()
  @IsString({ message: 'A senha atual deve ser uma string.' })
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  currentPassword: string;

  @ApiProperty({
    type: 'string',
    minLength: 6,
    maxLength: 72,
    writeOnly: true,
    description:
      '6–72 pontos de código Unicode; exatamente diferente da senha atual. Sem trim, coerção ou normalização.',
  })
  @rawValue()
  @IsString({ message: 'A nova senha deve ser uma string.' })
  @ValidateBy(
    {
      name: 'passwordCodePoints',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          Array.from(value).length >= 6 &&
          Array.from(value).length <= 72,
      },
    },
    { message: 'A nova senha deve ter de 6 a 72 caracteres.' },
  )
  @ValidateBy(
    {
      name: 'differentPassword',
      validator: {
        validate: (value: unknown, args) =>
          typeof value !== 'string' ||
          value !== (args?.object as ChangePasswordDto).currentPassword,
      },
    },
    { message: 'PASSWORD_UNCHANGED' },
  )
  newPassword: string;

  @ApiProperty({
    type: 'string',
    minLength: 1,
    writeOnly: true,
    description:
      'Confirmação transitória exatamente igual à nova senha; nunca persistida ou retornada.',
  })
  @rawValue()
  @IsString({ message: 'A confirmação deve ser uma string.' })
  @IsNotEmpty({ message: 'Confirme a nova senha.' })
  @ValidateBy(
    {
      name: 'passwordConfirmation',
      validator: {
        validate: (value: unknown, args) =>
          typeof value !== 'string' ||
          value === (args?.object as ChangePasswordDto).newPassword,
      },
    },
    { message: 'PASSWORD_CONFIRMATION_MISMATCH' },
  )
  confirmNewPassword: string;
}
