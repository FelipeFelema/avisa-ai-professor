import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsDefined,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiSchema, type ApiSchemaOptions } from '@nestjs/swagger';

const MAX_SAFE_PUSH_INTEGER = 2147483647;

@ApiSchema({
  name: 'PushBindingView',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class PushBindingViewDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  @IsUUID('4')
  bindingId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_SAFE_PUSH_INTEGER })
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_PUSH_INTEGER)
  lifecycleVersion!: number;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: MAX_SAFE_PUSH_INTEGER })
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_PUSH_INTEGER)
  tokenRevision!: number;

  @ApiProperty({ enum: ['RESERVED', 'ACTIVE'] })
  @IsIn(['RESERVED', 'ACTIVE'])
  state!: 'RESERVED' | 'ACTIVE';
}

@ApiSchema({
  name: 'PushInstallationView',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class PushInstallationViewDto {
  @ApiProperty({ type: 'boolean' })
  @IsBoolean()
  available!: boolean;

  @ApiProperty({ enum: ['ABSENT', 'RESERVED', 'ACTIVE', 'INACTIVE'] })
  @IsIn(['ABSENT', 'RESERVED', 'ACTIVE', 'INACTIVE'])
  state!: 'ABSENT' | 'RESERVED' | 'ACTIVE' | 'INACTIVE';

  @ApiProperty({
    oneOf: [{ $ref: '#/components/schemas/PushBindingView' }, { type: 'null' }],
  })
  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => PushBindingViewDto)
  binding!: PushBindingViewDto | null;

  @ApiProperty({
    oneOf: [
      {
        type: 'string',
        enum: [
          'CONFIGURATION_UNAVAILABLE',
          'REGISTRATION_INACTIVE',
          'TOKEN_INVALID',
        ],
      },
      { type: 'null' },
    ],
  })
  @ValidateIf((_object, value) => value !== null)
  @IsIn(['CONFIGURATION_UNAVAILABLE', 'REGISTRATION_INACTIVE', 'TOKEN_INVALID'])
  reason!:
    | 'CONFIGURATION_UNAVAILABLE'
    | 'REGISTRATION_INACTIVE'
    | 'TOKEN_INVALID'
    | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsDateString()
  testAvailableAt!: string | null;
}

@ApiSchema({
  name: 'PushTestAccepted',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class PushTestAcceptedDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  @IsUUID('4')
  attemptId!: string;

  @ApiProperty({ enum: ['ACCEPTED'] })
  @IsIn(['ACCEPTED'])
  status!: 'ACCEPTED';

  @ApiProperty({ type: 'string', format: 'date-time' })
  @IsDateString()
  acceptedAt!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @IsDateString()
  nextTestAvailableAt!: string;
}
