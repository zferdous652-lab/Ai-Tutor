import "express-async-errors";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./lib/env";
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

app.listen(env.port, () => {
  console.log(`AI Tutor API listening on :${env.port}`);
});
