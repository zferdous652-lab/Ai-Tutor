# MYTAMAN AI Tutor — MVP Plan

Source: `MYTAMAN_AI_Tutor_concept_draft.docx` (concept + full target architecture).
This document scopes down that architecture to what Phase 1 (internal prototype) actually needs.

## Target architecture (from the concept doc, for reference)

```
MYTAMAN-AI Tutor
├── Student App        (Learn chapter, Ask AI tutor, Quiz, Progress)
├── Parent Dashboard    (Child progress, Weak topics, Usage / Xpoints)
├── Content Management  (Upload, Summaries, Quizzes, Human review, Publish)
├── AI Gateway          (Token counter, Model router, Cache, Safety filter, Prompt templates)
├── Knowledge Base       (PDF parser, Chunking, Embeddings, Vector search)
└── Billing             (Free quota, Premium plan, Xpoints deduction)
```

## MVP scope (Phase 1 only)

The doc explicitly names 7 things to build first:

1. Upload Form 1 Sejarah PDF
2. Generate chapter summaries
3. Generate quizzes
4. Student chats with AI tutor
5. Save progress
6. Parent sees weak chapters
7. Limit usage by Xpoints / quota

Everything else in the full architecture (Redis cache, N8N orchestration, vector search /
embeddings, Stripe billing, Clerk/Auth0, Blob CDN, Docker on Azure Container Apps) is real and
worth building — but **not required to prove the product works**. This repo implements exactly
the 7 items above and defers the rest to later phases (see below).

## Simplifications vs. the full target stack (and why)

| Full-stack item | MVP decision | Reason |
|---|---|---|
| N8N orchestration | Skip — orchestrate the upload → summarize → quiz → publish pipeline directly in the API as plain async functions | One extra service (with its own auth, persistence, and deploy story) isn't worth it before the core loop is proven. The doc itself asked for "suggestions for simplicity" here. |
| Redis cache | Skip | No traffic yet to justify a cache; add when the AI Gateway needs it for a real cost/latency issue. |
| Vector search / embeddings (pgvector) | Skip — a chapter's own text is passed directly as chat/quiz context | One document, one family, one chapter at a time. Vector retrieval matters once the knowledge base has many documents. |
| Docker on Azure Container Apps | Skip for MVP — deploy both apps as plain Azure App Service (Node runtime), no containers | You haven't set up Docker on the Azure VM yet. App Service can run a Node app directly from a GitHub deploy, so Phase 1 needs zero container work. `docker-compose.yml` in this repo is for **local development only**. |
| Clerk / Auth0 | Skip — a single seeded demo family (one parent, one student) with a dev-only auth header | Real auth (and definitely a child-safe, parent-mediated auth flow) is a dedicated piece of work; don't block the product loop on it. Must be replaced before any real user data is involved. |
| Stripe billing | Skip — Xpoints are just an integer balance in Postgres, decremented per AI call | Matches "Later part of development: no need for now" in the doc. |
| Azure Blob Storage + CDN | Skip for MVP — uploaded PDF is parsed to text immediately and only the extracted text is persisted; the file itself is not retained | Removes a dependency (storage account + SDK) before it's needed. Add Blob Storage when re-processing of original files, previews, or non-PDF assets are required. |

## Data model (Postgres via Prisma)

`Family → User (PARENT | STUDENT) → Document → Chapter → Quiz / QuizAttempt / ChatMessage`,
plus an `XpointsLedger` for quota. See `apps/api/prisma/schema.prisma`.

## Phases (from the concept doc)

- **Phase 1 — Internal prototype** ← this repo's current focus
- Phase 2 — Form 1 Sejarah Tutor Pack (real content, human review step, KSSM/language/level selectors)
- Phase 3 — Parent dashboard (richer analytics)
- Phase 4 — Xpoints billing (real payments, Stripe)
- Phase 5 — Add more subjects
- Phase 6 — School / tuition centre package

## Golden path this MVP proves end-to-end

1. Seeded parent uploads a PDF → API extracts text and splits it into naive chapters.
2. API calls Claude to generate a summary per chapter.
3. API calls Claude to generate an MCQ quiz per chapter.
4. Seeded student opens a chapter, reads the summary, asks the AI tutor questions (Socratic —
   the prompt template asks guiding questions instead of giving answers outright), and takes the quiz.
5. Quiz attempts and chat activity are saved as progress; each AI call deducts Xpoints and is
   blocked once the balance hits zero.
6. Parent dashboard aggregates quiz scores per chapter to surface weak topics.
