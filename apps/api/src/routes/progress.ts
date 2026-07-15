import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { getXpointsBalance } from "../middleware/quota";

export const progressRouter = Router();

progressRouter.use(requireUser, requireRole("STUDENT"));

const quizAttemptSchema = z.object({
  quizId: z.string(),
  answers: z.array(z.number()), // selected option index per question, in question order
});

// Save progress (MVP step 5): quiz attempt with score + weak topics
progressRouter.post("/quiz-attempt", async (req, res) => {
  const parsed = quizAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { quizId, answers } = parsed.data;

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      chapter: { tutorPack: { enrollments: { some: { studentId: req.user!.id } } } },
    },
  });
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const questions = quiz.questions as {
    question: string;
    options: string[];
    correctIndex: number;
    topic: string;
  }[];

  let correct = 0;
  const weakTopics: string[] = [];
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) {
      correct += 1;
    } else {
      weakTopics.push(q.topic);
    }
  });
  const score = questions.length === 0 ? 0 : correct / questions.length;

  const attempt = await prisma.quizAttempt.create({
    data: { quizId, studentId: req.user!.id, score, weakTopics },
  });

  res.status(201).json(attempt);
});

progressRouter.get("/xpoints", async (req, res) => {
  res.json({ balance: await getXpointsBalance(req.user!.id) });
});
