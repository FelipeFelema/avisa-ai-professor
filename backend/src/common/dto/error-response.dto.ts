import {
  ApiProperty,
  ApiPropertyOptional,
  ApiSchema,
  ApiSchemaOptions,
} from '@nestjs/swagger';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'ErrorResponse',
  additionalProperties: false,
})
export class ErrorResponseDto {
  @ApiProperty({
    type: 'integer',
    minimum: 400,
    maximum: 599,
  })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({ type: 'string' })
  error?: string;
}
