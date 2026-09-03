import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

import { transformUserEmail } from '../../common/normalizers/user-normalizer';

export class LoginDto {
  @Transform(({ value }) => transformUserEmail(value as unknown))
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail não pode estar vazio' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma string' })
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;
}
