import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole, requireUser } from "../middleware/auth";

export const tutorPacksRouter = Router();

tutorPacksRouter.use(requireUser, requireRole("PARENT"));

// Browse published Tutor Packs available to enroll a child in.
tutorPacksRouter.get("/", async (_req, res) => {
  const packs = await prisma.tutorPack.findMany({
    where: { publishedAt: { not: null } },
    select: {
      id: true,
      title: true,
      subject: true,
      standard: true,
      language: true,
      tier: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });
  res.json(packs);
});
