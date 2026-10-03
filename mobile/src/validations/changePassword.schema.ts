import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z
      .string()
      .refine(
        (value) => Array.from(value).length >= 6 && Array.from(value).length <= 72,
        'A nova senha deve ter de 6 a 72 caracteres.',
      ),
    confirmNewPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .superRefine((values, context) => {
    if (values.newPassword === values.currentPassword)
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'A nova senha deve ser diferente da atual.',
      });
    if (values.confirmNewPassword !== values.newPassword)
      context.addIssue({
        code: 'custom',
        path: ['confirmNewPassword'],
        message: 'A confirmação deve ser igual à nova senha.',
      });
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
