import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'HealthResponse',
  additionalProperties: false,
})
export class HealthResponseDto {
  @ApiProperty({
    enum: ['ok'],
    example: 'ok',
  })
  status!: 'ok';
}
