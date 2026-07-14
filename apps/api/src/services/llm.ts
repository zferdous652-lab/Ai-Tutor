import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env";

// Seed of the "AI Gateway" from the full architecture: every call to the model goes through
// here, so token counting / caching / safety filtering can be added later without touching
// route code. Model routing is a single constant for now — swap/branch on it once there's a
// reason to use more than one model.
const MODEL = "claude-sonnet-4-5-20250929";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

function languageInstruction(language: string): string {
  return language === "ms"
    ? "Respond in Bahasa Malaysia."
    : "Respond in English.";
}

/** Rough token-cost estimate used for Xpoints deduction. Good enough for quota purposes. */
export function estimateXpointsCost(inputText: string): number {
  return Math.max(1, Math.ceil(inputText.length / 500));
}

export async function generateChapterSummary(
  chapterContent: string,
  language: string
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: `You are an assistant that writes clear, age-appropriate chapter summaries for school
students. ${languageInstruction(language)}`,
    messages: [
      {
        role: "user",
        content: `Summarize this textbook chapter in 4-6 short paragraphs, highlighting key
facts, dates, and terms a student should remember:\n\n${chapterContent}`,
      },
    ],
  });
  return extractText(message);
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
}

export async function generateChapterQuiz(
  chapterContent: string,
  language: string
): Promise<QuizQuestion[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `You generate multiple-choice quizzes for school students. ${languageInstruction(
      language
    )} Respond with ONLY a JSON array, no prose, matching this shape:
[{"question": string, "options": string[4], "correctIndex": number, "topic": string}]
"topic" is a short label (2-4 words) for the sub-topic the question tests, used later to find a
student's weak topics.`,
    messages: [
      {
        role: "user",
        content: `Generate 5 multiple-choice questions covering this chapter:\n\n${chapterContent}`,
      },
    ],
  });
  const text = extractText(message);
  return JSON.parse(extractJsonArray(text)) as QuizQuestion[];
}

export async function tutorReply(
  chapterContent: string,
  history: { role: "student" | "tutor"; content: string }[],
  studentMessage: string,
  language: string
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: `You are a patient Socratic tutor helping a student understand this chapter:

${chapterContent}

Guide the student toward answers with questions and hints rather than stating the answer
outright, unless they are clearly stuck after a couple of tries or explicitly ask for the answer.
Keep replies short (2-4 sentences). ${languageInstruction(language)}`,
    messages: [
      ...history.map((h) => ({
        role: h.role === "student" ? ("user" as const) : ("assistant" as const),
        content: h.content,
      })),
      { role: "user", content: studentMessage },
    ],
  });
  return extractText(message);
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Model response contained no text content");
  }
  return block.text;
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain a JSON array");
  }
  return text.slice(start, end + 1);
}
