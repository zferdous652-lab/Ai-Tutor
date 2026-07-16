import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { ALL_PROVIDER_NAMES, ProviderConfig } from "../lib/env";
import { requireRole, requireUser } from "../middleware/auth";
import { withTimeout } from "../lib/timeout";
import { formatVisualContext, generateChapterQuiz, generateChapterSummary, VisualNote } from "../services/llm";
import { getProviderStatuses, updateProviderSettings } from "../services/llm/settings";
import { extractPdfMarkdown, splitIntoChapters } from "../services/pdf";
import { generateVisualNotes } from "../services/visualNotes";

const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000;
const VISUAL_ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;

// Real course material (e.g. a 500-page textbook) can be large.
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
    analyzeVisuals,
  } = req.body as {
    title?: string;
    subject?: string;
    standard?: string;
    language?: string;
    tier?: string;
    analyzeVisuals?: string;
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

  // Respond immediately rather than holding the request open for however long extraction
  // takes on a large PDF (risks a client/proxy timeout, and leaves the admin staring at a
  // spinner). The pack is already visible in the admin list with status PROCESSING; the
  // frontend polls until it flips to DRAFT or FAILED. This does NOT run parsing on a separate
  // thread/process — it's still CPU work on the same Node event loop, just no longer blocking
  // the HTTP response for it. Fine for admin-only, low-concurrency uploads; if concurrent
  // large uploads ever cause noticeable latency for other requests, move this to a
  // worker_thread or a real background job.
  res.status(202).json({ tutorPackId: pack.id, status: pack.status });

  processUpload(pack.id, req.file.buffer, language, analyzeVisuals === "true").catch((err) => {
    console.error(`[admin] failed to process TutorPack ${pack.id}:`, err);
  });
});

async function processUpload(
  tutorPackId: string,
  fileBuffer: Buffer,
  language: string,
  analyzeVisuals: boolean
): Promise<void> {
  try {
    const rawText = await withTimeout(
      extractPdfMarkdown(fileBuffer),
      EXTRACTION_TIMEOUT_MS,
      "PDF extraction timed out — the file may be malformed or too complex to parse"
    );
    const chapters = splitIntoChapters(rawText);

    await prisma.$transaction([
      prisma.tutorPack.update({
        where: { id: tutorPackId },
        data: { rawText, status: "DRAFT" },
      }),
      ...chapters.map((chapter) =>
        prisma.chapter.create({
          data: {
            tutorPackId,
            order: chapter.order,
            title: chapter.title,
            content: chapter.content,
          },
        })
      ),
    ]);
  } catch (err) {
    await prisma.tutorPack.update({ where: { id: tutorPackId }, data: { status: "FAILED" } });
    throw err;
  }

  // Best-effort: visual analysis failing shouldn't undo a successful text extraction (the
  // pack is already usable without it). Opt-in since it's a real additional vision-LLM cost.
  if (analyzeVisuals) {
    try {
      const visualNotes = await withTimeout(
        generateVisualNotes(fileBuffer, language),
        VISUAL_ANALYSIS_TIMEOUT_MS,
        "Visual analysis timed out"
      );
      await prisma.tutorPack.update({
        where: { id: tutorPackId },
        data: { visualNotes: visualNotes as unknown as Prisma.InputJsonValue },
      });
    } catch (err) {
      console.error(`[admin] visual analysis failed for TutorPack ${tutorPackId}:`, err);
    }
  }
}

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

// Cleanup: remove a pack that's stuck, failed, or was created by mistake. Cascades through
// everything that references it, since none of those foreign keys cascade at the DB level.
adminRouter.delete("/tutor-packs/:packId", async (req, res) => {
  const pack = await prisma.tutorPack.findUnique({ where: { id: req.params.packId } });
  if (!pack) {
    res.status(404).json({ error: "Tutor pack not found" });
    return;
  }
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { chapter: { tutorPackId: pack.id } } }),
    prisma.quizAttempt.deleteMany({ where: { quiz: { chapter: { tutorPackId: pack.id } } } }),
    prisma.quiz.deleteMany({ where: { chapter: { tutorPackId: pack.id } } }),
    prisma.chapter.deleteMany({ where: { tutorPackId: pack.id } }),
    prisma.enrollment.deleteMany({ where: { tutorPackId: pack.id } }),
    prisma.tutorPack.delete({ where: { id: pack.id } }),
  ]);
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
  const visualContext = formatVisualContext(chapter.tutorPack.visualNotes as VisualNote[] | null);
  const summary = await generateChapterSummary(
    chapter.content,
    chapter.tutorPack.language,
    visualContext
  );
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
  const visualContext = formatVisualContext(chapter.tutorPack.visualNotes as VisualNote[] | null);
  const questions = await generateChapterQuiz(
    chapter.content,
    chapter.tutorPack.language,
    visualContext
  );
  const questionsJson = questions as unknown as Prisma.InputJsonValue;
  const quiz = await prisma.quiz.upsert({
    where: { chapterId: chapter.id },
    create: { chapterId: chapter.id, questions: questionsJson },
    update: { questions: questionsJson },
  });
  res.json({ quizId: quiz.id, questions: quiz.questions });
});

// Model Router Settings: lets an admin reorder the LLM fallback chain and enable/disable
// individual providers at runtime — never stores API keys, only which of the env-configured
// providers to use and in what order. Takes effect on the next LLM call, no redeploy needed.
adminRouter.get("/model-settings", async (_req, res) => {
  res.json({ providers: await getProviderStatuses() });
});

adminRouter.put("/model-settings", async (req, res) => {
  const { order, disabled } = req.body as { order?: unknown; disabled?: unknown };
  if (!Array.isArray(order) || !order.every((v) => typeof v === "string")) {
    res.status(400).json({ error: "order must be a string array" });
    return;
  }
  if (disabled !== undefined && (!Array.isArray(disabled) || !disabled.every((v) => typeof v === "string"))) {
    res.status(400).json({ error: "disabled must be a string array" });
    return;
  }
  const isProviderName = (v: string): v is ProviderConfig["name"] =>
    ALL_PROVIDER_NAMES.includes(v as ProviderConfig["name"]);
  if (!order.every(isProviderName) || !(disabled ?? []).every(isProviderName)) {
    res.status(400).json({ error: `provider names must be one of ${ALL_PROVIDER_NAMES.join(", ")}` });
    return;
  }
  const providers = await updateProviderSettings(
    order as ProviderConfig["name"][],
    (disabled ?? []) as ProviderConfig["name"][]
  );
  res.json({ providers });
});
