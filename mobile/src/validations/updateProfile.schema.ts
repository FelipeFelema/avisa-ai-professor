import { z } from 'zod';

import type { UpdateProfileRequest } from '@/types/auth';

const profileNamePattern = /^[\p{L}\s'-]+$/u;

const profileNameSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres.')
  .max(100, 'O nome deve ter no m\u00e1ximo 100 caracteres.')
  .regex(
    profileNamePattern,
    'No nome, use apenas letras, espa\u00e7os, h\u00edfen ou ap\u00f3strofo.',
  );

const profileEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email('Informe um e-mail v\u00e1lido.')
      .max(255, 'O e-mail deve ter no m\u00e1ximo 255 caracteres.'),
  );

export const updateProfileSchema = z.object({
  name: profileNameSchema,
  email: profileEmailSchema,
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

type CurrentProfileIdentity = Pick<UpdateProfileFormData, 'name' | 'email'>;

export function buildUpdateProfilePayload(
  currentProfile: CurrentProfileIdentity,
  values: UpdateProfileFormData,
): UpdateProfileRequest {
  const normalizedValues = updateProfileSchema.parse(values);
  const payload: UpdateProfileRequest = {};
  const currentName = currentProfile.name.trim();
  const currentEmail = currentProfile.email.trim().toLowerCase();

  if (normalizedValues.name !== currentName) {
    payload.name = normalizedValues.name;
  }

  if (normalizedValues.email !== currentEmail) {
    payload.email = normalizedValues.email;
  }

  return payload;
}
