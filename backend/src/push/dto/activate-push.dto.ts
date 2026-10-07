import {
  Equals,
  IsIn,
  IsInt,
  Length,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiSchema, type ApiSchemaOptions } from '@nestjs/swagger';

const MAX_SAFE_PUSH_INTEGER = 2147483647;

@ApiSchema({
  name: 'ActivatePushRequest',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class ActivatePushDto {
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
  expectedTokenRevision!: number;

  @ApiProperty({ enum: ['ANDROID', 'IOS'] })
  @IsIn(['ANDROID', 'IOS'])
  platform!: 'ANDROID' | 'IOS';

  @ApiProperty({
    type: 'string',
    minLength: 1,
    maxLength: 512,
    pattern: '^(?:ExpoPushToken|ExponentPushToken)\\[[A-Za-z0-9_-]{8,256}\\]$',
  })
  @IsString()
  @Length(1, 512)
  @Matches(/^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{8,256}\]$/)
  expoToken!: string;

  @ApiProperty({ enum: ['GRANTED'] })
  @Equals('GRANTED')
  permission!: 'GRANTED';
}
