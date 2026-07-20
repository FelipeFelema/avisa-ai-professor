import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório.')
    .min(3, 'O nome deve ter pelo menos 3 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.')
    .regex(
      /^[a-zA-Zá-úÁ-Ú\s'-]+$/,
      'No nome, use apenas letras, espaços, hífen ou apóstrofo. Números não são permitidos.',
    ),

  email: z.email('Informe um e-mail válido.'),

  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),

  teacherCode: z.string().optional(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
