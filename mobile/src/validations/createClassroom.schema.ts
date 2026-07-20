import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'O nome da turma deve ter pelo menos 3 caracteres.')
    .max(80, 'O nome da turma deve ter no máximo 80 caracteres.'),
});

export type CreateClassroomFormData = z.infer<typeof createClassroomSchema>;
