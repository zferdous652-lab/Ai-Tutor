import { Router } from "express";
import { prisma } from "../lib/prisma";
import { loadEnrolledChapter } from "../lib/enrollment";
import { requireRole, requireUser } from "../middleware/auth";
import { InsufficientXpointsError, spendXpoints } from "../middleware/quota";
import { estimateXpointsCost, tutorReply } from "../services/llm";

export const chatRouter = Router();

chatRouter.use(requireUser, requireRole("STUDENT"));

// Live AI tutor chat — a Premium/X-Points feature. Basic Tutor Packs are pre-generated
// content only (summary/quiz), so this is gated on the chapter's pack tier.
chatRouter.post("/:chapterId", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "Missing message" });
    return;
  }

  const chapter = await loadEnrolledChapter(req.params.chapterId, req.user!.id);
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  if (chapter.tutorPack.tier === "BASIC") {
    res.status(403).json({ error: "Chat with the AI tutor is a Premium feature" });
    return;
  }

  const history = await prisma.chatMessage.findMany({
    where: { chapterId: chapter.id, studentId: req.user!.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const reply = await tutorReply(
    chapter.content,
    history.map((h) => ({ role: h.role as "student" | "tutor", content: h.content })),
    message,
    req.user!.language
  );

  try {
    await spendXpoints(req.user!.id, estimateXpointsCost(message), "chat_message");
  } catch (err) {
    if (err instanceof InsufficientXpointsError) {
      res.status(402).json({ error: "Insufficient Xpoints" });
      return;
    }
    throw err;
  }

  const [studentMessage, tutorMessage] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { chapterId: chapter.id, studentId: req.user!.id, role: "student", content: message },
    }),
    prisma.chatMessage.create({
      data: { chapterId: chapter.id, studentId: req.user!.id, role: "tutor", content: reply },
    }),
  ]);

  res.json({ studentMessage, tutorMessage });
});

chatRouter.get("/:chapterId", async (req, res) => {
  const chapter = await loadEnrolledChapter(req.params.chapterId, req.user!.id);
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  const messages = await prisma.chatMessage.findMany({
    where: { chapterId: chapter.id, studentId: req.user!.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});
