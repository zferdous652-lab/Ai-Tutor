# Architecture — Phase 1 (MVP)

## Repo layout

```
Ai-Tutor/
├── apps/
│   ├── api/            AI Gateway + backend API (Express, TypeScript, Prisma)
│   └── web/             Admin / Parent / Student dashboards (Next.js App Router)
├── docs/                This document, MVP plan, Azure deployment guide
├── docker-compose.yml    Builds & runs postgres + api + web (local dev, or an Azure VM)
└── .env.example
```

Two deployable apps, one shared Postgres database. No separate "Content Management" or
"Knowledge Base" services yet — `apps/api` does PDF parsing, chunking, summary/quiz generation,
chat, progress, and quota, all in-process. Split these into separate workers once load requires it
(see MVP_PLAN.md).

## Three roles, three dashboards

Per the concept doc's v2 revision, the app is three separated experiences sharing one backend,
not one app with role-gated links:

- **Admin** (`/admin`, role `ADMIN`) — Content Management: upload a PDF, get chapters, generate
  a summary/quiz per chapter, publish the pack for students. This is staff-only; parents and
  students never see raw uploads.
- **Parent** (`/parent`, role `PARENT`) — browse published Tutor Packs, enroll a child, track
  their progress (Xpoints balance, weak chapters).
- **Student** (`/student`, role `STUDENT`) — work through the Tutor Packs they're enrolled in:
  read chapter summaries, take quizzes, chat with the AI tutor if the pack's tier allows it.

`apps/web/lib/session.tsx` fetches `GET /me` after sign-in and stores the caller's role; the nav
bar and each dashboard route render (or refuse) based on it.

## Tutor Packs, tiers, and the publish gate

A **Tutor Pack** (`TutorPack` model, e.g. "KSSM Form 1 Sejarah") is content an admin builds and
publishes — it is not owned by any family. A family gets access via an **Enrollment**
(parent → student → pack). Nothing is visible to a student until an admin sets `publishedAt`.

Each pack has a `tier`:

- **BASIC** — pre-generated content only (summary, quiz — flashcards/notes/mind-maps planned).
  Generated once by an admin, served to every enrolled student. No live AI at request time, so
  no Xpoints are spent by students on a Basic pack.
- **PREMIUM** / **XPOINTS** — additionally unlocks live AI tutor chat (Socratic, per-student).
  Chat is blocked with a 403 on a Basic pack (`chat.ts` checks `chapter.tutorPack.tier`); each
  chat message spends Xpoints, which is exactly the X-Points tier's pay-per-use model.

This mirrors the concept doc directly: *"80–90% of the experience comes from pre-generated
content... only the personalized conversation uses live AI, for premium packs."*

## Request flow (golden path)

```
Admin (web)   --upload PDF-->        api /admin/tutor-packs
                                          │  pdf2md extracts Markdown, headings (H1, falling
                                          │  back to H2, falling back to equal chunks) split
                                          │  it into chapters
                                          ▼
                                     TutorPack (draft) + Chapter rows saved
                                          │
              api PATCH/DELETE /admin/chapters/:id  --> human review: rename/drop a bad split
                                          │
              api /admin/chapters/:id/summary  --> model router --> Chapter.summary
              api /admin/chapters/:id/quiz      --> model router --> Quiz.questions (JSON)
                                          │
              api /admin/tutor-packs/:id/publish  --> sets publishedAt
                                          │
Parent (web)  <--browse published packs--  api /tutor-packs
Parent (web)  --enroll child-->            api /enrollments  (Enrollment row)
                                          │
Student (web) <--summary + quiz-- api /content/:chapterId   (enrollment-checked)

Student (web) --chat message--> api /chat/:chapterId  (enrollment- AND tier-checked)
                                    --> model router --> ChatMessage saved, Xpoints deducted

Student (web) --quiz answers--> api /progress/quiz-attempt --> QuizAttempt saved (score, weak topics)

Parent (web) <--weak chapters-- api /parent/dashboard  (aggregates QuizAttempt by chapter)
```

Every AI Gateway call (`summary`, `quiz`, `chat`) goes through `apps/api/src/services/llm/` —
the seed of the "AI Gateway" from the full architecture. It centralizes prompt templates and,
via a **model router**, provider selection:

```
services/llm/
├── types.ts               LlmProvider interface, ProviderError
├── providers/
│   ├── anthropic.ts        Claude, via @anthropic-ai/sdk
│   └── gemini.ts            Gemini, via @google/generative-ai
├── router.ts                ModelRouter: tries providers in order, falls back on ProviderError
└── index.ts                 Public API (generateChapterSummary, generateChapterQuiz, tutorReply)
```

`ANTHROPIC_API_KEY` and `GEMINI_API_KEY` are both optional, but at least one must be set (the API
fails fast on startup otherwise, with a clear error). If both are set, `MODEL_PROVIDER_ORDER`
(default `anthropic,gemini`) controls which is tried first; a rate limit, outage, or auth failure
on the first provider falls back to the next one automatically, so a single provider being down
doesn't take the whole app down. Token counting per student (for the "measure AI cost per
student" admin requirement), response caching, and safety filtering are the remaining AI Gateway
pieces to add later, at the `ModelRouter` or provider level, without touching route code.

## Data model

```
Family 1─n User (role: ADMIN | PARENT | STUDENT)
TutorPack (title, subject, standard, language, tier: BASIC|PREMIUM|XPOINTS, publishedAt)
TutorPack 1─n Chapter (order, content, summary)
Chapter 1─1 Quiz (questions JSON)
Chapter 1─n ChatMessage (studentId, role, content)
Quiz 1─n QuizAttempt (studentId, score, weakTopics JSON)
Family/User/TutorPack ─── Enrollment (familyId, studentId, tutorPackId) — grants student access
User 1─n XpointsLedger (delta, reason)  -- balance = sum(delta)
```

See `apps/api/prisma/schema.prisma` for the authoritative definitions.

## Auth (Phase 1 only — replace before real users)

There is no real auth yet. `apps/api/src/middleware/auth.ts` reads an `x-user-id` header and
looks up a seeded demo user (one admin, one parent, one student — created by
`apps/api/src/seed.ts`). The web app fetches `/me` to learn the caller's role and routes them to
the matching dashboard. This is intentionally not production-ready: the concept doc itself says
"don't build auth yourself" for a product with child accounts — plan to bring in Clerk or Auth0
with parent-mediated child accounts before onboarding real families. The `ADMIN` role using the
same dev scheme is a deliberate Phase 1 shortcut too — it's an internal-only role for now, but
still needs a real credential check before staff access matters.

## Bilingual support (EN / Bahasa Malay)

The web app ships a minimal i18n layer (`apps/web/i18n/{en,ms}.json` + a React context) for UI
strings, and a `language` field on `TutorPack` / `User` that's passed to the LLM prompt templates
so summaries, quizzes, and chat responses are generated in the requested language. This is a
lightweight, dependency-free approach appropriate for two languages; migrate to `next-intl` if a
third language is added.

## What's deliberately not here yet

See the simplification table in `docs/MVP_PLAN.md` — Redis, N8N, pgvector/embeddings, Blob
Storage, Stripe billing, and real auth are all out of scope for Phase 1 by design, not by
oversight. Also not yet built: flashcards/notes/mind-maps (Basic tier content types beyond
summary/quiz), per-student AI cost tracking, and Final Assessments (Premium).
