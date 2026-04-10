/*
  Warnings:

  - You are about to drop the `_ClassroomToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ClassroomToUser" DROP CONSTRAINT "_ClassroomToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ClassroomToUser" DROP CONSTRAINT "_ClassroomToUser_B_fkey";

-- DropTable
DROP TABLE "_ClassroomToUser";

-- CreateTable
CREATE TABLE "UserClassroom" (
    "userId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,

    CONSTRAINT "UserClassroom_pkey" PRIMARY KEY ("userId","classroomId")
);

-- AddForeignKey
ALTER TABLE "UserClassroom" ADD CONSTRAINT "UserClassroom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClassroom" ADD CONSTRAINT "UserClassroom_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
