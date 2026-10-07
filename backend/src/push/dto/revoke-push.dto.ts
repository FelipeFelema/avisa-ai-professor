import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiSchema, type ApiSchemaOptions } from '@nestjs/swagger';

const MAX_SAFE_PUSH_INTEGER = 2147483647;

@ApiSchema({
  name: 'RevokePushRequest',
  additionalProperties: false,
} as ApiSchemaOptions & { additionalProperties: false })
export class RevokePushDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  @IsUUID('4')
  bindingId!: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: MAX_SAFE_PUSH_INTEGER })
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_PUSH_INTEGER)
  lifecycleVersion!: number;

  @ApiProperty({ enum: ['USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED'] })
  @IsIn(['USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED'])
  reason!: 'USER_DISABLED' | 'LOGOUT' | 'PERMISSION_REVOKED';
}
