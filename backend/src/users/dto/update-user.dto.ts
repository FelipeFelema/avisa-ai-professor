import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
} from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  name?: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  @IsNotEmpty({ message: 'O E-mail não pode estar vazio' })
  email?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password?: string;
}
