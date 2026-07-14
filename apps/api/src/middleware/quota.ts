import { prisma } from "../lib/prisma";

export class InsufficientXpointsError extends Error {
  constructor() {
    super("Insufficient Xpoints");
    this.name = "InsufficientXpointsError";
  }
}

export async function getXpointsBalance(userId: string): Promise<number> {
  const result = await prisma.xpointsLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

/**
 * Deducts `cost` Xpoints for `userId` if they have enough balance, recording the ledger entry.
 * Throws InsufficientXpointsError otherwise. Call this AFTER a successful LLM call so a failed
 * generation doesn't burn quota.
 */
export async function spendXpoints(userId: string, cost: number, reason: string): Promise<void> {
  const balance = await getXpointsBalance(userId);
  if (balance < cost) {
    throw new InsufficientXpointsError();
  }
  await prisma.xpointsLedger.create({
    data: { userId, delta: -cost, reason },
  });
}
