import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  name?: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  @IsNotEmpty({ message: 'O E-mail não pode estar vazio' })
  @MaxLength(255, { message: 'O e-mail deve ter no máximo 255 caracteres' })
  email?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  password?: string;
}
