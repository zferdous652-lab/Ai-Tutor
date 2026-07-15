import { prisma } from "./prisma";

/** A chapter a student can reach, only if their family enrolled them in its Tutor Pack. */
export async function loadEnrolledChapter(chapterId: string, studentId: string) {
  return prisma.chapter.findFirst({
    where: { id: chapterId, tutorPack: { enrollments: { some: { studentId } } } },
    include: { tutorPack: true },
  });
}
