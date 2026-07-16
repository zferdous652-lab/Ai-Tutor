import { prisma } from "../../lib/prisma";

const SETTINGS_ID = "singleton";

/** The original hardcoded prompts, now just the seed/reset target — editable per-provider-call
 * instruction text lives in the PromptSetting DB row instead. Dynamic parts (chapter content,
 * language instruction, visual context) are still spliced in by services/llm/index.ts, not
 * stored here — only the persona/instruction portion is admin-editable. */
export const DEFAULT_PROMPTS = {
  summarySystemPrompt:
    "You are an assistant that writes clear, age-appropriate chapter summaries for school students.",
  quizSystemPrompt: `You generate multiple-choice quizzes for school students. Respond with ONLY a JSON array, no prose, matching this shape:
[{"question": string, "options": string[4], "correctIndex": number, "topic": string}]
"topic" is a short label (2-4 words) for the sub-topic the question tests, used later to find a student's weak topics.`,
  tutorSystemPrompt:
    "You are a patient Socratic tutor helping a student understand this chapter. Guide the student toward answers with questions and hints rather than stating the answer outright, unless they are clearly stuck after a couple of tries or explicitly ask for the answer. Keep replies short (2-4 sentences).",
  visualSystemPrompt: "You analyze textbook pages for a school course.",
} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;
export const PROMPT_KEYS = Object.keys(DEFAULT_PROMPTS) as PromptKey[];

export type PromptSettings = Record<PromptKey, string>;

async function loadRow() {
  const existing = await prisma.promptSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.promptSetting.create({ data: { id: SETTINGS_ID, ...DEFAULT_PROMPTS } });
}

export async function getPrompts(): Promise<PromptSettings> {
  const row = await loadRow();
  return {
    summarySystemPrompt: row.summarySystemPrompt,
    quizSystemPrompt: row.quizSystemPrompt,
    tutorSystemPrompt: row.tutorSystemPrompt,
    visualSystemPrompt: row.visualSystemPrompt,
  };
}

export async function updatePrompt(key: PromptKey, value: string): Promise<PromptSettings> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Prompt cannot be empty");
  }
  await prisma.promptSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULT_PROMPTS, [key]: trimmed },
    update: { [key]: trimmed },
  });
  return getPrompts();
}

export async function resetPrompt(key: PromptKey): Promise<PromptSettings> {
  return updatePrompt(key, DEFAULT_PROMPTS[key]);
}
