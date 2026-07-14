import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { getXpointsBalance } from "../middleware/quota";

export const parentRouter = Router();

parentRouter.use(requireUser, requireRole("PARENT"));

// Parent sees weak chapters (MVP step 6) + Xpoints usage (MVP step 7)
parentRouter.get("/dashboard", async (req, res) => {
  const students = await prisma.user.findMany({
    where: { familyId: req.user!.familyId, role: "STUDENT" },
  });

  const dashboard = await Promise.all(
    students.map(async (student) => {
      const attempts = await prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        include: { quiz: { include: { chapter: { select: { id: true, title: true } } } } },
        orderBy: { createdAt: "desc" },
      });

      const byChapter = new Map<
        string,
        { chapterId: string; chapterTitle: string; latestScore: number; weakTopics: Set<string> }
      >();
      for (const attempt of attempts) {
        const chapterId = attempt.quiz.chapter.id;
        const existing = byChapter.get(chapterId);
        const weakTopics = attempt.weakTopics as string[];
        if (!existing) {
          byChapter.set(chapterId, {
            chapterId,
            chapterTitle: attempt.quiz.chapter.title,
            latestScore: attempt.score,
            weakTopics: new Set(weakTopics),
          });
        } else {
          weakTopics.forEach((t) => existing.weakTopics.add(t));
        }
      }

      const chapterProgress = [...byChapter.values()]
        .map((c) => ({ ...c, weakTopics: [...c.weakTopics] }))
        .sort((a, b) => a.latestScore - b.latestScore);

      return {
        studentId: student.id,
        studentName: student.name,
        xpointsBalance: await getXpointsBalance(student.id),
        chapterProgress,
        weakestChapters: chapterProgress.filter((c) => c.latestScore < 0.6),
      };
    })
  );

  res.json(dashboard);
});
