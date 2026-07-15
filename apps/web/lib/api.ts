const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, userId: string, init?: RequestInit): Promise<T> {
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
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export type Role = "ADMIN" | "PARENT" | "STUDENT";
export type PackTier = "BASIC" | "PREMIUM" | "XPOINTS";

export interface Me {
  id: string;
  familyId: string;
  role: Role;
  language: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
}

export interface ChapterSummary {
  id: string;
  order: number;
  title: string;
  summary: string | null;
  quiz: { id: string } | null;
}

export interface TutorPackAdminView {
  id: string;
  title: string;
  subject: string;
  standard: string;
  language: string;
  tier: PackTier;
  status: "PROCESSING" | "DRAFT" | "FAILED";
  publishedAt: string | null;
  visualNotes: { page: number; description: string }[] | null;
  chapters: ChapterSummary[];
}

export interface TutorPackBrowseView {
  id: string;
  title: string;
  subject: string;
  standard: string;
  language: string;
  tier: PackTier;
  publishedAt: string;
}

export interface ChapterDetail {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  quiz: { id: string; questions: QuizQuestion[] } | null;
  tutorPack: { tier: PackTier; title: string };
}

export interface Enrollment {
  id: string;
  studentId: string;
  tutorPackId: string;
  tutorPack: { id: string; title: string; subject: string; standard: string; tier: PackTier };
  student: { id: string; name: string };
}

export const api = {
  getMe: (userId: string) => request<Me>("/me", userId),

  // Admin
  adminListPacks: (userId: string) => request<TutorPackAdminView[]>("/admin/tutor-packs", userId),

  // Upload is processed in the background — this returns as soon as the pack is created
  // (status PROCESSING), not once chapters exist. Poll adminListPacks for status/chapters.
  adminUploadPack: (userId: string, form: FormData) =>
    request<{ tutorPackId: string; status: TutorPackAdminView["status"] }>(
      "/admin/tutor-packs",
      userId,
      { method: "POST", body: form }
    ),

  adminPublishPack: (userId: string, tutorPackId: string) =>
    request<TutorPackAdminView>(`/admin/tutor-packs/${tutorPackId}/publish`, userId, {
      method: "POST",
    }),

  adminRenameChapter: (userId: string, chapterId: string, title: string) =>
    request<ChapterSummary>(`/admin/chapters/${chapterId}`, userId, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  adminDeleteChapter: (userId: string, chapterId: string) =>
    request<void>(`/admin/chapters/${chapterId}`, userId, { method: "DELETE" }),

  adminGenerateSummary: (userId: string, chapterId: string) =>
    request<{ chapterId: string; summary: string }>(
      `/admin/chapters/${chapterId}/summary`,
      userId,
      { method: "POST" }
    ),

  adminGenerateQuiz: (userId: string, chapterId: string) =>
    request<{ quizId: string; questions: QuizQuestion[] }>(
      `/admin/chapters/${chapterId}/quiz`,
      userId,
      { method: "POST" }
    ),

  // Parent
  browseTutorPacks: (userId: string) =>
    request<TutorPackBrowseView[]>("/tutor-packs", userId),

  createEnrollment: (userId: string, studentId: string, tutorPackId: string) =>
    request<Enrollment>("/enrollments", userId, {
      method: "POST",
      body: JSON.stringify({ studentId, tutorPackId }),
    }),

  listEnrollments: (userId: string) => request<Enrollment[]>("/enrollments", userId),

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

  // Student
  getPackChapters: (userId: string, tutorPackId: string) =>
    request<{ id: string; title: string; chapters: ChapterSummary[] }>(
      `/content/pack/${tutorPackId}`,
      userId
    ),

  getChapter: (userId: string, chapterId: string) =>
    request<ChapterDetail>(`/content/${chapterId}`, userId),

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

  getXpoints: (userId: string) => request<{ balance: number }>("/progress/xpoints", userId),
};
