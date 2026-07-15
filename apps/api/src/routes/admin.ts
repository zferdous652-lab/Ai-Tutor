import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { generateChapterQuiz, generateChapterSummary } from "../services/llm";
import { extractPdfMarkdown, splitIntoChapters } from "../services/pdf";

// Real course material (e.g. a 500-page textbook) can be large; processing is still
// synchronous for now (see docs/MVP_PLAN.md — async upload is a tracked follow-up), so this
// mainly guards against pathological uploads rather than being a considered ceiling.
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } });
export const adminRouter = Router();

adminRouter.use(requireUser, requireRole("ADMIN"));

const VALID_TIERS = ["BASIC", "PREMIUM", "XPOINTS"] as const;

// Content Management: upload course material and create a draft Tutor Pack.
adminRouter.post("/tutor-packs", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing file" });
    return;
  }
  const {
    title,
    subject = "Sejarah",
    standard = "KSSM",
    language = "en",
    tier = "BASIC",
  } = req.body as {
    title?: string;
    subject?: string;
    standard?: string;
    language?: string;
    tier?: string;
  };
  if (!title) {
    res.status(400).json({ error: "Missing title" });
    return;
  }
  if (!VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
    res.status(400).json({ error: `tier must be one of ${VALID_TIERS.join(", ")}` });
    return;
  }

  const pack = await prisma.tutorPack.create({
    data: { title, subject, standard, language, tier: tier as (typeof VALID_TIERS)[number] },
  });

  try {
    const rawText = await extractPdfMarkdown(req.file.buffer);
    const chapters = splitIntoChapters(rawText);

    await prisma.$transaction([
      prisma.tutorPack.update({
        where: { id: pack.id },
        data: { rawText, status: "DRAFT" },
      }),
      ...chapters.map((chapter) =>
        prisma.chapter.create({
          data: {
            tutorPackId: pack.id,
            order: chapter.order,
            title: chapter.title,
            content: chapter.content,
          },
        })
      ),
    ]);

    res.status(201).json({ tutorPackId: pack.id, chapterCount: chapters.length });
  } catch (err) {
    await prisma.tutorPack.update({ where: { id: pack.id }, data: { status: "FAILED" } });
    throw err;
  }
});

adminRouter.get("/tutor-packs", async (_req, res) => {
  const packs = await prisma.tutorPack.findMany({
    include: {
      chapters: {
        select: { id: true, order: true, title: true, summary: true, quiz: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(packs);
});

// Human review of auto-detected chapters, before summary/quiz generation or publish: rename a
// mis-titled chapter, or drop one the detector split incorrectly.
adminRouter.patch("/chapters/:chapterId", async (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: "Missing title" });
    return;
  }
  const chapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId } });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const updated = await prisma.chapter.update({
    where: { id: chapter.id },
    data: { title: title.trim().slice(0, 120) },
  });
  res.json(updated);
});

adminRouter.delete("/chapters/:chapterId", async (req, res) => {
  const chapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId } });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  try {
    await prisma.chapter.delete({ where: { id: chapter.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      res.status(409).json({
        error: "Can't delete a chapter that already has a quiz or chat history",
      });
      return;
    }
    throw err;
  }
  res.status(204).send();
});

// Publish gate: nothing is visible to a parent/student until this is called.
adminRouter.post("/tutor-packs/:packId/publish", async (req, res) => {
  const pack = await prisma.tutorPack.findUnique({ where: { id: req.params.packId } });
  if (!pack) {
    res.status(404).json({ error: "Tutor pack not found" });
    return;
  }
  const updated = await prisma.tutorPack.update({
    where: { id: pack.id },
    data: { publishedAt: new Date() },
  });
  res.json(updated);
});

// Pre-generated content (Basic Tutor Pack): summary, generated once by an admin and served
// to every enrolled student. Not billed against any student's Xpoints — that quota is for
// live, per-student AI usage (chat), not shared platform content generation.
adminRouter.post("/chapters/:chapterId/summary", async (req, res) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id: req.params.chapterId },
    include: { tutorPack: true },
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const summary = await generateChapterSummary(chapter.content, chapter.tutorPack.language);
  const updated = await prisma.chapter.update({ where: { id: chapter.id }, data: { summary } });
  res.json({ chapterId: updated.id, summary: updated.summary });
});

adminRouter.post("/chapters/:chapterId/quiz", async (req, res) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id: req.params.chapterId },
    include: { tutorPack: true },
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const questions = await generateChapterQuiz(chapter.content, chapter.tutorPack.language);
  const questionsJson = questions as unknown as Prisma.InputJsonValue;
  const quiz = await prisma.quiz.upsert({
    where: { chapterId: chapter.id },
    create: { chapterId: chapter.id, questions: questionsJson },
    update: { questions: questionsJson },
  });
  res.json({ quizId: quiz.id, questions: quiz.questions });
});
