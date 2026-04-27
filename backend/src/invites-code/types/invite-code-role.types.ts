import { Role } from '@prisma/client';

export const INVITE_CODE_ROLES = [Role.PROFESSOR, Role.ADMIN] as const;

export type InviteCodeRole = (typeof INVITE_CODE_ROLES)[number];

export function isInviteCodeRole(role: Role): role is InviteCodeRole {
  return (INVITE_CODE_ROLES as readonly Role[]).includes(role);
}
