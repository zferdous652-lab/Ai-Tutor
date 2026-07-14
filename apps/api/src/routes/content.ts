import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { InsufficientXpointsError, spendXpoints } from "../middleware/quota";
import { estimateXpointsCost, generateChapterQuiz, generateChapterSummary } from "../services/llm";

export const contentRouter = Router();

contentRouter.use(requireUser);

async function loadChapterForFamily(chapterId: string, familyId: string) {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, document: { familyId } },
  });
  return chapter;
}

contentRouter.get("/:chapterId", async (req, res) => {
  const chapter = await prisma.chapter.findFirst({
    where: { id: req.params.chapterId, document: { familyId: req.user!.familyId } },
    include: { quiz: { select: { id: true, questions: true } } },
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  res.json(chapter);
});

// Generate chapter summaries (MVP step 2)
contentRouter.post("/:chapterId/summary", requireRole("PARENT"), async (req, res) => {
  const chapter = await loadChapterForFamily(req.params.chapterId, req.user!.familyId);
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }

  const summary = await generateChapterSummary(chapter.content, req.user!.language);
  try {
    await spendXpoints(req.user!.id, estimateXpointsCost(chapter.content), "chapter_summary");
  } catch (err) {
    if (err instanceof InsufficientXpointsError) {
      res.status(402).json({ error: "Insufficient Xpoints" });
      return;
    }
    throw err;
  }

  const updated = await prisma.chapter.update({
    where: { id: chapter.id },
    data: { summary },
  });
  res.json({ chapterId: updated.id, summary: updated.summary });
});

// Generate quizzes (MVP step 3)
contentRouter.post("/:chapterId/quiz", requireRole("PARENT"), async (req, res) => {
  const chapter = await loadChapterForFamily(req.params.chapterId, req.user!.familyId);
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }

  const questions = await generateChapterQuiz(chapter.content, req.user!.language);
  try {
    await spendXpoints(req.user!.id, estimateXpointsCost(chapter.content), "chapter_quiz");
  } catch (err) {
    if (err instanceof InsufficientXpointsError) {
      res.status(402).json({ error: "Insufficient Xpoints" });
      return;
    }
    throw err;
  }

  const questionsJson = questions as unknown as Prisma.InputJsonValue;
  const quiz = await prisma.quiz.upsert({
    where: { chapterId: chapter.id },
    create: { chapterId: chapter.id, questions: questionsJson },
    update: { questions: questionsJson },
  });
  res.json({ quizId: quiz.id, questions: quiz.questions });
});
