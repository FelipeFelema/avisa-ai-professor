import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(3, 'O título deve possuir pelo menos 3 caracteres.').max(120),

  content: z.string().min(3, 'O conteúdo deve possuir pelo menos 3 caracteres.').max(2000),

  durationInDays: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(15), z.literal(30)]),
});

export type CreateAnnouncementFormData = z.infer<typeof createAnnouncementSchema>;
