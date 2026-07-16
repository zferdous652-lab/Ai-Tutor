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

## Content pipeline: extraction, async processing, visual captioning

`apps/api/src/services/pdf.ts` extracts a PDF as Markdown by shelling out to
`apps/api/scripts/pdf_to_markdown.py` (pdfplumber), which detects headings from font size — no
dependency on a textbook using specific words like "Chapter"/"Bab" — and returns Markdown that
`splitIntoChapters` splits on heading structure (H1, falling back to H2, falling back to
equal-sized chunks only if there's no usable heading structure at all).

This used to be a pure-Node library (`@opendocsg/pdf2md`, also pdf.js-based) but was replaced
after it hung indefinitely on a real course PDF in production — confirmed via `docker stats`
showing the API container at ~0% CPU, i.e. genuinely stuck awaiting something, not just slow.
The Python subprocess is invoked with `execFile`'s `timeout` option, which actually **kills**
the process on timeout (4 min) — unlike an abandoned JS Promise, which can't be cancelled. This
is why the API's Docker base image is `node:20-bookworm-slim` (Debian/glibc) rather than Alpine:
the Python PDF ecosystem's prebuilt wheels are manylinux (glibc), and gambling on musl
compatibility wasn't worth it after everything else that went wrong here. `@napi-rs/canvas`
(used for visual captioning below) resolves its own glibc build automatically on this base.

Upload processing (`POST /admin/tutor-packs`) runs in the background: the request returns as
soon as the `TutorPack` row exists (`202`, status `PROCESSING`), and `apps/web`'s admin page
polls every 3s until the pack flips to `DRAFT` or `FAILED`. This avoids a client/proxy timeout
on a large PDF, but is **not** true parallelism for the rest of the request handling — it's a
fire-and-forget async function on the same Node process (the actual extraction work, however,
now runs in a separate OS process via the Python subprocess above, so it no longer blocks the
API's event loop the way the old in-process JS library did). Two further robustness gaps found
via real testing on the Azure VM, both fixed: an outer 5-minute timeout around the whole
extraction step (`routes/admin.ts`, belt-and-suspenders alongside the subprocess-level one
above), and a startup reconciliation (`index.ts`) that marks any pack still `PROCESSING` as
`FAILED` on boot, since a container restart mid-upload orphans the in-memory work with no way
to resume it. Fine for admin-only, low-concurrency uploads (see `docs/MVP_PLAN.md`).

Optionally (an `analyzeVisuals` checkbox on upload), `apps/api/src/services/visualNotes.ts`
renders every page of the PDF to an image (`unpdf` + `@napi-rs/canvas`, a Rust/Skia canvas
implementation with prebuilt musl binaries — works in the Alpine Docker image without compiling
native code) and batches them into vision-model calls (`LlmProvider.describeImages`, implemented
on both the Anthropic and Gemini providers) asking only for diagrams/maps/photos/charts, skipping
pure-text pages. Results are stored as `TutorPack.visualNotes` (`[{page, description}]`) and
appended as shared context to every chapter's summary/quiz/chat prompt in that pack — not
attributed to the specific chapter the figure appears in (see `docs/MVP_PLAN.md` for why that's
an accepted simplification for now). This is a one-time, admin-triggered cost amortized across
every enrolled student, batched (15 pages/call) and capped (200 pages) so it can't run away on a
very large document. A captioning failure is caught separately and doesn't fail the pack — the
already-extracted chapters remain usable without visual notes.

## Request flow (golden path)

```
Admin (web)   --upload PDF-->        api /admin/tutor-packs
                                          │  responds immediately (202, status PROCESSING);
                                          │  pdfplumber (Python subprocess) extracts Markdown,
                                          │  splitIntoChapters splits into chapters
                                          │  (H1, falling back to H2, falling back to equal
                                          │  chunks) in the background — admin UI polls
                                          ▼
                                     TutorPack (status: DRAFT or FAILED) + Chapter rows saved
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
├── types.ts               LlmProvider interface (generateText + describeImages), ProviderError
├── providers/
│   ├── anthropic.ts        Claude, via @anthropic-ai/sdk
│   └── gemini.ts            Gemini, via @google/generative-ai
├── router.ts                ModelRouter: tries providers in order, falls back on ProviderError
└── index.ts                 Public API (generateChapterSummary, generateChapterQuiz, tutorReply,
                              describePageDiagrams, formatVisualContext)
```

`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `OPENAI_API_KEY` are all optional env vars — a
provider can instead be added (or replaced, or removed) from the admin "Model Router Settings"
tab at runtime, no redeploy needed. If a provider's env var IS set, it always takes precedence
over a key entered in the UI (the UI shows that provider's key field as locked in that case).
`MODEL_PROVIDER_ORDER` (default `anthropic,gemini,openai`) controls the initial fallback
priority for however many providers end up configured; a rate limit, outage, or auth failure on
the first one falls back to the next automatically, so a single provider being down doesn't take
the whole app down. Order and enabled/disabled state can also be changed at runtime from the
"Model Router Settings" tab — see that section below.

### Model router settings

Provider API keys entered via the "Model Router Settings" tab are encrypted at rest
(AES-256-GCM, see `apps/api/src/lib/crypto.ts`) in a `ProviderCredential` table, keyed by an
optional `CREDENTIAL_ENCRYPTION_KEY` env var (recommended for production; falls back to a key
derived from `DATABASE_URL` otherwise, with a startup warning). A separate `ModelRouterSetting`
singleton row stores the fallback order and which providers are disabled. Neither table is
touched by env-var-configured providers — those are always resolved from `process.env` first.
Token counting per student (for the "measure AI cost per
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
summary/quiz), per-student AI cost tracking, Final Assessments (Premium), a true background job
queue for uploads (currently fire-and-forget on the same process), and precise per-chapter
attribution of visual notes (currently whole-pack).
