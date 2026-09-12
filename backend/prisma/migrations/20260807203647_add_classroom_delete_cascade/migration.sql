-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "UserClassroom" DROP CONSTRAINT "UserClassroom_classroomId_fkey";

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClassroom" ADD CONSTRAINT "UserClassroom_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
