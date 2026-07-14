import "express-async-errors";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { env } from "./lib/env";
import { chatRouter } from "./routes/chat";
import { contentRouter } from "./routes/content";
import { documentsRouter } from "./routes/documents";
import { parentRouter } from "./routes/parent";
import { progressRouter } from "./routes/progress";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/documents", documentsRouter);
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
