import { IsEnum, IsInt, Min } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateInviteCodeDto {
  @IsEnum(Role)
  role!: Role;

  @IsInt()
  @Min(1)
  expiresInDays!: number;
}
