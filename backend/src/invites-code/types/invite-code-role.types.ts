import { Role } from '@prisma/client';

export const INVITE_CODE_ROLES = [Role.PROFESSOR] as const;
export type InviteCodeRole = (typeof INVITE_CODE_ROLES)[number];

export function isInviteCodeRole(role: Role): role is InviteCodeRole {
  return role === Role.PROFESSOR;
}
