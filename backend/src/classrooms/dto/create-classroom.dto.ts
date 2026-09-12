import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'CreateClassroomRequest',
  additionalProperties: false,
})
export class CreateClassroomDto {
  @ApiProperty({
    type: 'string',
    minLength: 3,
    maxLength: 80,
  })
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MinLength(3, { message: 'O nome deve ter no mínimo 3 caracteres' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name!: string;
}
