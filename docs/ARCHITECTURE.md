# Architecture — Phase 1 (MVP)

## Repo layout

```
Ai-Tutor/
├── apps/
│   ├── api/            AI Gateway + backend API (Express, TypeScript, Prisma)
│   └── web/             Student App + Parent Dashboard (Next.js App Router)
├── docs/                This document, MVP plan, Azure deployment guide
├── docker-compose.yml    Builds & runs postgres + api + web (local dev, or an Azure VM)
└── .env.example
```

Two deployable apps, one shared Postgres database. No separate "Content Management" or
"Knowledge Base" services yet — `apps/api` does PDF parsing, chunking, summary/quiz generation,
chat, progress, and quota, all in-process. Split these into separate workers once load requires it
(see MVP_PLAN.md).

## Request flow (golden path)

```
Parent (web) --upload PDF--> api /documents
                                   │  pdf-parse extracts text
                                   │  naive chapter splitter (page-range heuristic)
                                   ▼
                              Chapter rows saved
                                   │
                   api /content/:chapterId/summary  --> Claude --> Chapter.summary
                   api /content/:chapterId/quiz      --> Claude --> Quiz.questions (JSON)
                                   │
Student (web) <--- summary + quiz ┘

Student (web) --chat message--> api /chat/:chapterId --> Claude (chapter text as context,
                                                            Socratic prompt template)
                                                        --> ChatMessage saved, Xpoints deducted

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
doesn't take the whole app down. Token counting / response caching / safety filtering are the
remaining AI Gateway pieces to add later, at the `ModelRouter` or provider level, without
touching route code.

## Data model

```
Family 1─n User (role: PARENT | STUDENT)
Family 1─n Document (subject, standard, language, rawText, status)
Document 1─n Chapter (order, content, summary)
Chapter 1─1 Quiz (questions JSON)
Chapter 1─n ChatMessage (studentId, role, content)
Quiz 1─n QuizAttempt (studentId, score, weakTopics JSON)
User 1─n XpointsLedger (delta, reason)  -- balance = sum(delta)
```

See `apps/api/prisma/schema.prisma` for the authoritative definitions.

## Auth (Phase 1 only — replace before real users)

There is no real auth yet. `apps/api/src/middleware/auth.ts` reads an `x-user-id` header and
looks up a seeded demo user (one parent, one student, one family — created by
`apps/api/src/seed.ts`). The web app hardcodes these two demo user IDs to switch between the
Parent Dashboard and Student App. This is intentionally not production-ready: the concept doc
itself says "don't build auth yourself" for a product with child accounts — plan to bring in
Clerk or Auth0 with parent-mediated child accounts before onboarding real families.

## Bilingual support (EN / Bahasa Malay)

The web app ships a minimal i18n layer (`apps/web/i18n/{en,ms}.json` + a React context) for UI
strings, and a `language` field on `Document` / `User` that's passed to the LLM prompt templates
so summaries, quizzes, and chat responses are generated in the requested language. This is a
lightweight, dependency-free approach appropriate for two languages; migrate to `next-intl` if a
third language is added.

## What's deliberately not here yet

See the simplification table in `docs/MVP_PLAN.md` — Redis, N8N, pgvector/embeddings, Blob
Storage, Stripe billing, and real auth are all out of scope for Phase 1 by design, not by
oversight.
