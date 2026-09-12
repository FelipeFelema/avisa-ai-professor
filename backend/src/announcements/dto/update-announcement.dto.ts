import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';
import { ANNOUNCEMENT_ALLOWED_DURATIONS } from './create-announcement.dto';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'UpdateAnnouncementRequest',
  additionalProperties: false,
})
export class UpdateAnnouncementDto {
  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 120,
  })
  @IsString({ message: 'O título deve ser uma string' })
  @IsNotEmpty({ message: 'O título não pode estar vazio' })
  @MinLength(3, { message: 'O título deve ter no mínimo 3 caracteres' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres' })
  title!: string;

  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 2000,
  })
  @IsString({ message: 'O conteúdo deve ser uma string' })
  @IsNotEmpty({ message: 'O conteúdo não pode estar vazio' })
  @MinLength(3, { message: 'O conteúdo deve ter no mínimo 3 caracteres' })
  @MaxLength(2000, { message: 'O conteúdo deve ter no máximo 2000 caracteres' })
  content!: string;

  @ApiProperty({
    type: 'integer',
    enum: [...ANNOUNCEMENT_ALLOWED_DURATIONS],
    enumName: 'AnnouncementDuration',
  })
  @IsInt({ message: 'A duração deve ser um número inteiro' })
  @IsIn(ANNOUNCEMENT_ALLOWED_DURATIONS, {
    message: 'A duração deve ser 1, 3, 7, 15 ou 30 dias',
  })
  durationInDays!: number;
}
