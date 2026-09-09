import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsUUID,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

export const ANNOUNCEMENT_ALLOWED_DURATIONS = [1, 3, 7, 15, 30] as const;

@closedSchema({
  name: 'CreateAnnouncementRequest',
  additionalProperties: false,
})
export class CreateAnnouncementDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
  })
  @IsString({ message: 'O ID da turma deve ser uma string' })
  @IsNotEmpty({ message: 'O ID da turma não pode estar vazio' })
  @IsUUID('4', { message: 'O ID da turma deve ser um UUID válido' })
  classroomId!: string;

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

@closedSchema({
  name: 'AnnouncementAuthor',
  additionalProperties: false,
})
export class AnnouncementAuthorDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

@closedSchema({
  name: 'Announcement',
  additionalProperties: false,
})
export class AnnouncementDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  classroomId!: string;

  @ApiProperty({ type: 'string', minLength: 3, maxLength: 120 })
  title!: string;

  @ApiProperty({ type: 'string', minLength: 3, maxLength: 2000 })
  content!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: AnnouncementAuthorDto })
  author!: AnnouncementAuthorDto;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}
