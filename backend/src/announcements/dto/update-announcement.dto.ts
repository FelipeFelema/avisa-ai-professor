import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ANNOUNCEMENT_ALLOWED_DURATIONS } from './create-announcement.dto';

export class UpdateAnnouncementDto {
  @IsString({ message: 'O título deve ser uma string' })
  @IsNotEmpty({ message: 'O título não pode estar vazio' })
  @MinLength(3, { message: 'O título deve ter no mínimo 3 caracteres' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres' })
  title!: string;

  @IsString({ message: 'O conteúdo deve ser uma string' })
  @IsNotEmpty({ message: 'O conteúdo não pode estar vazio' })
  @MinLength(3, { message: 'O conteúdo deve ter no mínimo 3 caracteres' })
  @MaxLength(2000, { message: 'O conteúdo deve ter no máximo 2000 caracteres' })
  content!: string;

  @IsInt({ message: 'A duração deve ser um número inteiro' })
  @IsIn(ANNOUNCEMENT_ALLOWED_DURATIONS, {
    message: 'A duração deve ser 1, 3, 7, 15 ou 30 dias',
  })
  durationInDays!: number;
}
