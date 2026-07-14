import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";
import { extractPdfText, splitIntoChapters } from "../services/pdf";

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
export const documentsRouter = Router();

documentsRouter.use(requireUser);

// Upload Form 1 Sejarah PDF (MVP step 1)
documentsRouter.post(
  "/",
  requireRole("PARENT"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const { title, subject = "Sejarah", standard = "KSSM" } = req.body as {
      title?: string;
      subject?: string;
      standard?: string;
    };
    if (!title) {
      res.status(400).json({ error: "Missing title" });
      return;
    }

    const document = await prisma.document.create({
      data: {
        familyId: req.user!.familyId,
        title,
        subject,
        standard,
        language: req.user!.language,
        status: "PROCESSING",
      },
    });

    try {
      const rawText = await extractPdfText(req.file.buffer);
      const chapters = splitIntoChapters(rawText);

      await prisma.$transaction([
        prisma.document.update({
          where: { id: document.id },
          data: { rawText, status: "READY" },
        }),
        ...chapters.map((chapter) =>
          prisma.chapter.create({
            data: {
              documentId: document.id,
              order: chapter.order,
              title: chapter.title,
              content: chapter.content,
            },
          })
        ),
      ]);

      res.status(201).json({ documentId: document.id, chapterCount: chapters.length });
    } catch (err) {
      await prisma.document.update({ where: { id: document.id }, data: { status: "FAILED" } });
      throw err;
    }
  }
);

documentsRouter.get("/", async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { familyId: req.user!.familyId },
    include: { chapters: { select: { id: true, order: true, title: true, summary: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(documents);
});
