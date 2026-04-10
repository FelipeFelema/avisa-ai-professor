import { Prisma } from '@prisma/client';

export type ClassroomWithUsers = Prisma.ClassroomGetPayload<{
  include: {
    userClassrooms: {
      include: { user: { select: { id: true; name: true } } };
    };
  };
}>;
