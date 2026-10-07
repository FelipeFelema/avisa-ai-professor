import { ApiSchema, type ApiSchemaOptions } from '@nestjs/swagger';

@ApiSchema({
  name: 'EmptyPushRequest',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class EmptyPushDto {}
