import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiSchema,
  ApiSchemaOptions,
} from '@nestjs/swagger';
import {
  transformUserEmail,
  transformUserName,
  USER_NAME_PATTERN,
} from '../../common/normalizers/user-normalizer';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'RegisterRequest',
  additionalProperties: false,
})
export class CreateUserDto {
  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 100,
  })
  @Transform(({ value }) => transformUserName(value as unknown))
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  @Matches(USER_NAME_PATTERN, {
    message: 'O nome deve conter apenas letras, espaços, hífen e apóstrofo',
  })
  name!: string;

  @ApiProperty({
    type: 'string',
    format: 'email',
    maxLength: 255,
  })
  @Transform(({ value }) => transformUserEmail(value as unknown))
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail não pode estar vazio' })
  @MaxLength(255, { message: 'O e-mail deve ter no máximo 255 caracteres' })
  email!: string;

  @ApiProperty({
    type: 'string',
    minLength: 6,
    maxLength: 72,
    writeOnly: true,
  })
  @IsString({ message: 'A senha deve ser uma string' })
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  password!: string;

  @ApiPropertyOptional({
    type: 'string',
    writeOnly: true,
  })
  @IsString({ message: 'O código do professor deve ser uma string' })
  @IsOptional()
  teacherCode?: string;
}
