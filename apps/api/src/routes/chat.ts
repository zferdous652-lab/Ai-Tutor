import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { InsufficientXpointsError, spendXpoints } from "../middleware/quota";
import { estimateXpointsCost, tutorReply } from "../services/llm";

export const chatRouter = Router();

chatRouter.use(requireUser, requireRole("STUDENT"));

// Student chats with AI tutor (MVP step 4)
chatRouter.post("/:chapterId", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "Missing message" });
    return;
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: req.params.chapterId, document: { familyId: req.user!.familyId } },
  });
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
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
  const messages = await prisma.chatMessage.findMany({
    where: {
      chapterId: req.params.chapterId,
      studentId: req.user!.id,
      chapter: { document: { familyId: req.user!.familyId } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});
