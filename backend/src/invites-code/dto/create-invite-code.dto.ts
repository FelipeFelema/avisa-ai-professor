import { IsIn, IsInt, Min } from 'class-validator';
import * as inviteCodeRoleTypes from '../types/invite-code-role.types';
export class CreateInviteCodeDto {
  @IsIn(inviteCodeRoleTypes.INVITE_CODE_ROLES, {
    message: 'O convite só pode ser criado para PROFESSOR ou ADMIN',
  })
  role!: inviteCodeRoleTypes.InviteCodeRole;

  @IsInt()
  @Min(1)
  expiresInDays!: number;
}
