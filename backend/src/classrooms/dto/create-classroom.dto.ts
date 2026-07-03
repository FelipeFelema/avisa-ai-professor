import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name!: string;
}
