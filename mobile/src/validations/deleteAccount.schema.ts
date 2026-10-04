import { z } from 'zod';

export const deleteAccountSchema = z.strictObject({
  currentPassword: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.'),
  confirmationPhrase: z
    .string({ error: 'Digite exatamente EXCLUIR MINHA CONTA.' })
    .refine(
      (value): boolean => value === 'EXCLUIR MINHA CONTA',
      'Digite exatamente EXCLUIR MINHA CONTA.',
    ),
});

export type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

export const accountDeletionImpactSchema = z
  .strictObject({
    role: z.enum(['PARENT', 'PROFESSOR', 'ADMIN']),
    canDelete: z.boolean(),
    blockReason: z.literal('LAST_ADMIN_REQUIRED').nullable(),
    ownedClassroomsCount: z.number().int().nonnegative(),
    announcementsInOwnedClassroomsCount: z.number().int().nonnegative(),
    externalMembershipsCount: z.number().int().nonnegative(),
    authoredAnnouncementsInOtherClassroomsCount: z.number().int().nonnegative(),
  })
  .refine((impact) =>
    impact.canDelete
      ? impact.blockReason === null
      : impact.role === 'ADMIN' && impact.blockReason === 'LAST_ADMIN_REQUIRED',
  );
