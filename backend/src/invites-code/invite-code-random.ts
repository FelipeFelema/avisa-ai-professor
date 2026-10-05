import { randomBytes } from 'node:crypto';

export function randomInviteCodeBytes(size: number): Buffer {
  return randomBytes(size);
}
