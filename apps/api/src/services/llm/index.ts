import { ProviderConfig } from "../../lib/env";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { ModelRouter } from "./router";
import { getPrompts } from "./prompts";
import { getEffectiveApiKey, resolveActiveProviderOrder } from "./settings";
import { ChatTurn, ImagePage, LlmProvider } from "./types";

function buildProvider(name: ProviderConfig["name"], apiKey: string): LlmProvider {
  switch (name) {
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "gemini":
      return new GeminiProvider(apiKey);
    case "openai":
      return new OpenAIProvider(apiKey);
  }
}

// SDK clients are cheap to reuse, so we cache one per provider — but the active API key can now
// change at runtime (env var still wins, but a key can also be added/edited/removed from the
// admin Model Router Settings tab without a redeploy), so the cache is keyed on the key's value
// and rebuilt whenever it changes.
const instanceCache = new Map<ProviderConfig["name"], { apiKey: string; provider: LlmProvider }>();

async function getProviderInstance(name: ProviderConfig["name"]): Promise<LlmProvider | null> {
  const apiKey = await getEffectiveApiKey(name);
  if (!apiKey) return null;
  const cached = instanceCache.get(name);
  if (cached && cached.apiKey === apiKey) return cached.provider;
  const provider = buildProvider(name, apiKey);
  instanceCache.set(name, { apiKey, provider });
  return provider;
}

async function getRouter(): Promise<ModelRouter> {
  const order = await resolveActiveProviderOrder();
  const providers = (await Promise.all(order.map(getProviderInstance))).filter(
    (p): p is LlmProvider => p !== null
  );
  if (providers.length === 0) {
    throw new Error(
      "No LLM providers are enabled. Add and enable an API key from the admin Model Router Settings tab."
    );
  }
  return new ModelRouter(providers);
}

function languageInstruction(language: string): string {
  return language === "ms" ? "Respond in Bahasa Malaysia." : "Respond in English.";
}

/** Rough token-cost estimate used for Xpoints deduction. Good enough for quota purposes. */
export function estimateXpointsCost(inputText: string): number {
  return Math.max(1, Math.ceil(inputText.length / 500));
}

/** Appends a shared "figures in this course material" appendix, if any were captioned, so
 * diagrams/maps/photos (invisible to plain text extraction) inform generation. Not attributed
 * to a specific chapter — see docs/MVP_PLAN.md for why that's a known, accepted simplification. */
function withVisualContext(chapterContent: string, visualContext?: string): string {
  if (!visualContext) return chapterContent;
  return `${chapterContent}\n\n---\nFigures, maps, and photos appearing somewhere in this course material (may or may not be in this specific chapter):\n${visualContext}`;
}

export async function generateChapterSummary(
  chapterContent: string,
  language: string,
  visualContext?: string
): Promise<string> {
  const prompts = await getPrompts();
  return (await getRouter()).generateText({
    system: `${prompts.summarySystemPrompt} ${languageInstruction(language)}`,
    messages: [
      {
        role: "user",
        content: `Summarize this textbook chapter in 4-6 short paragraphs, highlighting key
facts, dates, and terms a student should remember:\n\n${withVisualContext(chapterContent, visualContext)}`,
      },
    ],
    maxTokens: 800,
  });
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
}

export async function generateChapterQuiz(
  chapterContent: string,
  language: string,
  visualContext?: string
): Promise<QuizQuestion[]> {
  const prompts = await getPrompts();
  const text = await (await getRouter()).generateText({
    system: `${prompts.quizSystemPrompt} ${languageInstruction(language)}`,
    messages: [
      {
        role: "user",
        content: `Generate 5 multiple-choice questions covering this chapter:\n\n${withVisualContext(chapterContent, visualContext)}`,
      },
    ],
    maxTokens: 1500,
  });
  return JSON.parse(extractJsonArray(text)) as QuizQuestion[];
}

export async function tutorReply(
  chapterContent: string,
  history: { role: "student" | "tutor"; content: string }[],
  studentMessage: string,
  language: string,
  visualContext?: string
): Promise<string> {
  const messages: ChatTurn[] = [
    ...history.map((h) => ({
      role: h.role === "student" ? ("user" as const) : ("assistant" as const),
      content: h.content,
    })),
    { role: "user" as const, content: studentMessage },
  ];

  const prompts = await getPrompts();
  return (await getRouter()).generateText({
    system: `${prompts.tutorSystemPrompt}

Chapter content:
${withVisualContext(chapterContent, visualContext)}

${languageInstruction(language)}`,
    messages,
    maxTokens: 500,
  });
}

export interface VisualNote {
  page: number;
  description: string;
}

/** Formats stored VisualNote[] (or null, if visual analysis wasn't requested/found nothing)
 * into the string generateChapterSummary/generateChapterQuiz/tutorReply expect. */
export function formatVisualContext(notes: VisualNote[] | null | undefined): string | undefined {
  if (!notes || notes.length === 0) return undefined;
  return notes.map((n) => `- Page ${n.page}: ${n.description}`).join("\n");
}

/**
 * Vision call: given a batch of rendered PDF page images, describe any diagrams, maps,
 * photos, or charts (skip pages that are pure text — this is meant to surface content plain
 * text extraction misses, not duplicate it).
 */
export async function describePageDiagrams(
  images: ImagePage[],
  language: string
): Promise<VisualNote[]> {
  const prompts = await getPrompts();
  const text = await (await getRouter()).describeImages({
    system: `${prompts.visualSystemPrompt} ${languageInstruction(language)}`,
    prompt: `Each image is one page of a textbook, labeled with its page number below. For each
page that contains a diagram, map, photo, chart, or illustration, write a short (1-3 sentence)
description of what it depicts, in enough detail that someone who can't see the image would
understand its educational content. Skip any page that is pure text with no such visual.

Page numbers, in image order: ${images.map((img) => img.page).join(", ")}

Respond with ONLY a JSON array, no prose, matching this shape:
[{"page": number, "description": string}]
Omit pages with nothing visual — return [] if none of these pages have diagrams/maps/photos/charts.`,
    images,
    maxTokens: 1500,
  });
  return JSON.parse(extractJsonArray(text)) as VisualNote[];
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain a JSON array");
  }
  return text.slice(start, end + 1);
}
