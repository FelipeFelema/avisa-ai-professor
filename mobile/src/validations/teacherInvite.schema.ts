import { z } from 'zod';
import type { TeacherInviteResult } from '@/types/teacher-invite';

const isoUtcMilliseconds = z.string().datetime({ offset: false, precision: 3 });

const teacherInviteResponseSchema = z
  .strictObject({
    id: z.string().uuid(),
    code: z.string().regex(/^PROF-[A-F0-9]{32}$/),
    role: z.literal('PROFESSOR'),
    isActive: z.literal(true),
    createdAt: isoUtcMilliseconds,
    expiresAt: isoUtcMilliseconds,
    updatedAt: isoUtcMilliseconds,
  })
  .refine((invite) => Date.parse(invite.expiresAt) - Date.parse(invite.createdAt) === 604_800_000);

export function parseTeacherInviteResponse(
  input: unknown,
): { success: true; data: TeacherInviteResult } | { success: false } {
  const parsed = teacherInviteResponseSchema.safeParse(input);
  if (!parsed.success) return { success: false };
  return { success: true, data: parsed.data };
}
