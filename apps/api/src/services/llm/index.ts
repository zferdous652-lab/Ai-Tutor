import { env } from "../../lib/env";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { ModelRouter } from "./router";
import { ChatTurn, ImagePage, LlmProvider } from "./types";

function buildProvider(config: (typeof env.providers)[number]): LlmProvider {
  switch (config.name) {
    case "anthropic":
      return new AnthropicProvider(config.apiKey);
    case "gemini":
      return new GeminiProvider(config.apiKey);
  }
}

const router = new ModelRouter(env.providers.map(buildProvider));

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
  return router.generateText({
    system: `You are an assistant that writes clear, age-appropriate chapter summaries for school
students. ${languageInstruction(language)}`,
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
  const text = await router.generateText({
    system: `You generate multiple-choice quizzes for school students. ${languageInstruction(
      language
    )} Respond with ONLY a JSON array, no prose, matching this shape:
[{"question": string, "options": string[4], "correctIndex": number, "topic": string}]
"topic" is a short label (2-4 words) for the sub-topic the question tests, used later to find a
student's weak topics.`,
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

  return router.generateText({
    system: `You are a patient Socratic tutor helping a student understand this chapter:

${withVisualContext(chapterContent, visualContext)}

Guide the student toward answers with questions and hints rather than stating the answer
outright, unless they are clearly stuck after a couple of tries or explicitly ask for the answer.
Keep replies short (2-4 sentences). ${languageInstruction(language)}`,
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
  const text = await router.describeImages({
    system: `You analyze textbook pages for a school course. ${languageInstruction(language)}`,
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
