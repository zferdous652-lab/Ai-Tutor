import { env } from "../../lib/env";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { ModelRouter } from "./router";
import { ChatTurn, LlmProvider } from "./types";

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

export async function generateChapterSummary(
  chapterContent: string,
  language: string
): Promise<string> {
  return router.generateText({
    system: `You are an assistant that writes clear, age-appropriate chapter summaries for school
students. ${languageInstruction(language)}`,
    messages: [
      {
        role: "user",
        content: `Summarize this textbook chapter in 4-6 short paragraphs, highlighting key
facts, dates, and terms a student should remember:\n\n${chapterContent}`,
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
  language: string
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
        content: `Generate 5 multiple-choice questions covering this chapter:\n\n${chapterContent}`,
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
  language: string
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

${chapterContent}

Guide the student toward answers with questions and hints rather than stating the answer
outright, unless they are clearly stuck after a couple of tries or explicitly ask for the answer.
Keep replies short (2-4 sentences). ${languageInstruction(language)}`,
    messages,
    maxTokens: 500,
  });
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain a JSON array");
  }
  return text.slice(start, end + 1);
}
