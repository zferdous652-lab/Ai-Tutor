const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  userId: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      "x-user-id": userId,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json();
}

export interface ChapterSummary {
  id: string;
  order: number;
  title: string;
  summary: string | null;
}

export interface DocumentDto {
  id: string;
  title: string;
  subject: string;
  standard: string;
  status: "PROCESSING" | "READY" | "FAILED";
  chapters: ChapterSummary[];
}

export interface ChapterDetail {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  quiz: { id: string; questions: QuizQuestion[] } | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
}

export const api = {
  listDocuments: (userId: string) => request<DocumentDto[]>("/documents", userId),

  getChapter: (userId: string, chapterId: string) =>
    request<ChapterDetail>(`/content/${chapterId}`, userId),

  uploadDocument: (userId: string, form: FormData) =>
    request<{ documentId: string; chapterCount: number }>("/documents", userId, {
      method: "POST",
      body: form,
    }),

  generateSummary: (userId: string, chapterId: string) =>
    request<{ chapterId: string; summary: string }>(`/content/${chapterId}/summary`, userId, {
      method: "POST",
    }),

  generateQuiz: (userId: string, chapterId: string) =>
    request<{ quizId: string; questions: unknown[] }>(`/content/${chapterId}/quiz`, userId, {
      method: "POST",
    }),

  getChatHistory: (userId: string, chapterId: string) =>
    request<{ id: string; role: string; content: string }[]>(`/chat/${chapterId}`, userId),

  sendChatMessage: (userId: string, chapterId: string, message: string) =>
    request<{
      studentMessage: { id: string; role: string; content: string };
      tutorMessage: { id: string; role: string; content: string };
    }>(`/chat/${chapterId}`, userId, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  submitQuizAttempt: (userId: string, quizId: string, answers: number[]) =>
    request<{ score: number; weakTopics: string[] }>("/progress/quiz-attempt", userId, {
      method: "POST",
      body: JSON.stringify({ quizId, answers }),
    }),

  getXpoints: (userId: string) =>
    request<{ balance: number }>("/progress/xpoints", userId),

  getParentDashboard: (userId: string) =>
    request<
      {
        studentId: string;
        studentName: string;
        xpointsBalance: number;
        chapterProgress: {
          chapterId: string;
          chapterTitle: string;
          latestScore: number;
          weakTopics: string[];
        }[];
        weakestChapters: { chapterId: string; chapterTitle: string; latestScore: number }[];
      }[]
    >("/parent/dashboard", userId),
};
