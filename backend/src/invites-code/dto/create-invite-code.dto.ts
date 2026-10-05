import { IsIn, IsString } from 'class-validator';
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
    description: 'Papel fixo para novas emissões: PROFESSOR.',
  })
  @IsIn(inviteCodeRoleTypes.INVITE_CODE_ROLES, {
    message: 'O convite só pode ser criado para PROFESSOR',
  })
  @IsString()
  role!: inviteCodeRoleTypes.InviteCodeRole;
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
    enum: ['PROFESSOR'],
    description: 'Papel fixo do convite recém-criado.',
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
