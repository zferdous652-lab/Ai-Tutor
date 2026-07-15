import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export type AppRole = "ADMIN" | "PARENT" | "STUDENT";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; familyId: string; role: AppRole; language: string };
    }
  }
}

/**
 * Phase 1 only: identifies the caller from an `x-user-id` header against the seeded demo
 * family. There is no password, session, or token here. Replace with Clerk/Auth0 (with
 * parent-mediated child accounts) before any real user data is involved — see
 * docs/ARCHITECTURE.md.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (!userId) {
    res.status(401).json({ error: "Missing x-user-id header" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ error: "Unknown user" });
    return;
  }
  req.user = {
    id: user.id,
    familyId: user.familyId,
    role: user.role,
    language: user.language,
  };
  next();
}

export function requireRole(role: AppRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: `Requires ${role} role` });
      return;
    }
    next();
  };
}
