import { IsIn, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiSchema, ApiSchemaOptions } from '@nestjs/swagger';
import * as inviteCodeRoleTypes from '../types/invite-code-role.types';

type ClosedSchemaOptions = ApiSchemaOptions & {
  additionalProperties: false;
};

function closedSchema(options: ClosedSchemaOptions): ClassDecorator {
  return ApiSchema(options);
}

@closedSchema({
  name: 'CreateInviteCodeRequest',
  additionalProperties: false,
})
export class CreateInviteCodeDto {
  @ApiProperty({
    type: 'string',
    enum: [...inviteCodeRoleTypes.INVITE_CODE_ROLES],
  })
  @IsIn(inviteCodeRoleTypes.INVITE_CODE_ROLES, {
    message: 'O convite só pode ser criado para PROFESSOR ou ADMIN',
  })
  role!: inviteCodeRoleTypes.InviteCodeRole;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  expiresInDays!: number;
}

@closedSchema({
  name: 'InviteCodeResponse',
  additionalProperties: false,
})
export class InviteCodeResponseDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', example: 'PROF-EXAMPLE' })
  code!: string;

  @ApiProperty({
    type: 'string',
    enum: [...inviteCodeRoleTypes.INVITE_CODE_ROLES],
  })
  role!: inviteCodeRoleTypes.InviteCodeRole;

  @ApiProperty({ type: 'boolean' })
  isActive!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}
