import "express-async-errors";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { adminRouter } from "./routes/admin";
import { chatRouter } from "./routes/chat";
import { contentRouter } from "./routes/content";
import { enrollmentsRouter } from "./routes/enrollments";
import { meRouter } from "./routes/me";
import { parentRouter } from "./routes/parent";
import { progressRouter } from "./routes/progress";
import { tutorPacksRouter } from "./routes/tutorPacks";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/me", meRouter);
app.use("/admin", adminRouter);
app.use("/tutor-packs", tutorPacksRouter);
app.use("/enrollments", enrollmentsRouter);
app.use("/content", contentRouter);
app.use("/chat", chatRouter);
app.use("/progress", progressRouter);
app.use("/parent", parentRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Upload processing (see routes/admin.ts) runs as a fire-and-forget in-memory async function,
// not a real job queue — if the process restarts mid-upload (a redeploy, a crash, `docker
// compose up --build`), the TutorPack row is left stuck at PROCESSING forever with no process
// left to finish or fail it, and the original file bytes are gone. Reconcile on every boot so
// a restart produces a visible, actionable FAILED pack instead of a silent zombie.
async function reconcileOrphanedUploads(): Promise<void> {
  const { count } = await prisma.tutorPack.updateMany({
    where: { status: "PROCESSING" },
    data: { status: "FAILED" },
  });
  if (count > 0) {
    console.warn(
      `[startup] marked ${count} Tutor Pack(s) FAILED that were stuck PROCESSING from a previous run — re-upload them`
    );
  }
}

reconcileOrphanedUploads()
  .catch((err) => console.error("[startup] failed to reconcile orphaned uploads:", err))
  .finally(() => {
    app.listen(env.port, () => {
      console.log(`AI Tutor API listening on :${env.port}`);
    });
  });
