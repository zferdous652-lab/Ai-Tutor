import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireUser } from "../middleware/auth";

export const enrollmentsRouter = Router();

enrollmentsRouter.use(requireUser);

const createSchema = z.object({
  studentId: z.string(),
  tutorPackId: z.string(),
});

// A parent gives one of their children access to a published Tutor Pack.
enrollmentsRouter.post("/", async (req, res) => {
  if (req.user!.role !== "PARENT") {
    res.status(403).json({ error: "Requires PARENT role" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { studentId, tutorPackId } = parsed.data;

  const student = await prisma.user.findFirst({
    where: { id: studentId, familyId: req.user!.familyId, role: "STUDENT" },
  });
  if (!student) {
    res.status(404).json({ error: "Student not found in your family" });
    return;
  }
  const pack = await prisma.tutorPack.findFirst({
    where: { id: tutorPackId, publishedAt: { not: null } },
  });
  if (!pack) {
    res.status(404).json({ error: "Tutor pack not found or not published" });
    return;
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { studentId_tutorPackId: { studentId, tutorPackId } },
    create: { familyId: req.user!.familyId, studentId, tutorPackId },
    update: {},
  });
  res.status(201).json(enrollment);
});

// Parents see their family's enrollments; students see their own.
enrollmentsRouter.get("/", async (req, res) => {
  const where =
    req.user!.role === "STUDENT" ? { studentId: req.user!.id } : { familyId: req.user!.familyId };
  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      tutorPack: { select: { id: true, title: true, subject: true, standard: true, tier: true } },
      student: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(enrollments);
});
