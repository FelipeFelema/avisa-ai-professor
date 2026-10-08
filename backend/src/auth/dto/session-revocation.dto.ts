import { IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';

const schema: ApiSchemaOptions & { additionalProperties: false } = {
  name: 'SessionRevocation',
  additionalProperties: false,
};
@ApiSchema(schema)
export class SessionRevocationDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  @IsUUID('4')
  sid!: string;

  @ApiProperty({
    type: 'string',
    minLength: 43,
    maxLength: 43,
    description:
      'Capability opaca exclusiva de revogação; nunca é JWT ou credencial de login.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  capability!: string;
}
