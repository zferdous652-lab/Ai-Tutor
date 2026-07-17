# MYTAMAN AI Tutor

Bilingual (English / Bahasa Malaysia) AI tutor web app built around **Tutor Packs**: an admin
builds and publishes a course (e.g. KSSM Form 1 Sejarah) from a PDF, parents enroll their child
in it, and the student works through AI-generated summaries and quizzes — plus, on Premium/
X-Points packs, a live Socratic AI tutor chat.

This README is the orientation point — what's built, how the pieces fit together, and where to
go for more detail. It's written to be equally useful to a person or an AI agent picking up this
repo cold.

## Documentation map

| Doc | What it's for |
|---|---|
| `README.md` (this file) | Orientation: what's built, repo layout, quickstart, env vars |
| `docs/MVP_PLAN.md` | Product scope decisions — what's in Phase 1, what's deliberately deferred, and why |
| `docs/ARCHITECTURE.md` | Deep technical dive — request flow, data model, LLM router internals, content pipeline |
| `docs/AZURE_DEPLOYMENT.md` | How to deploy (Docker Compose on a VM, or Azure App Service without Docker) |

If you're an AI agent inspecting this repo for the first time: read this file fully, skim
`docs/ARCHITECTURE.md` for the parts relevant to your task, then go straight to the source —
`apps/api/prisma/schema.prisma` is the ground truth for the data model, and
`apps/api/src/routes/*.ts` is the ground truth for the API surface.

## What's built

**Admin** (`/admin`, role `ADMIN`)
- Upload a PDF, get it split into chapters automatically (heading-structure detection, not
  keyword matching — see `docs/ARCHITECTURE.md`), rename/delete a mis-detected chapter
- Generate a summary and a multiple-choice quiz per chapter via the AI model router
- Optionally caption diagrams/maps/photos in the PDF with a vision model
- **Review content** (`/admin/pack/[id]/review`) — see every chapter's generated summary, full
  quiz (with correct answers marked), captioned figures, and the extracted source text, before
  publishing
- Publish a pack so parents/students can see it; delete a pack (cascades through its content)
- **Model Router Settings** (`/admin/model-settings`) — a platform-config tab, not tied to any
  one Tutor Pack:
  - Add, replace, or remove each AI provider's API key (Anthropic / Gemini / OpenAI) directly
    from the UI — encrypted at rest, no SSH/`.env` editing required. An env var, if set, always
    takes precedence over a UI-entered key for that provider.
  - Reorder the fallback chain and enable/disable individual providers at runtime — if the
    first-priority provider hits a rate limit, outage, or auth failure, the router automatically
    falls back to the next enabled one.
  - Edit the AI system prompts (chapter summaries, quiz generation, live tutor chat persona,
    diagram captioning) — tune tone/behavior without a code change or redeploy.

**Parent** (`/parent`, role `PARENT`)
- Browse published Tutor Packs, enroll a child
- Per-child dashboard: Xpoints balance, weakest chapters (aggregated from quiz attempts)

**Student** (`/student`, role `STUDENT`)
- See enrolled Tutor Packs → chapters; read the generated summary, take the quiz
- Chat with a Socratic AI tutor about the chapter — gated to Premium/X-Points tier packs; Basic
  tier is pre-generated content only, no live AI
- Chat spends Xpoints (a simple integer quota per student); blocked once the balance hits zero

**Platform-level**
- Three-provider LLM fallback router (Anthropic Claude, Google Gemini, OpenAI), with runtime
  reordering/enable-disable and UI-managed API keys (see Model Router Settings above)
- Bilingual generation (EN / Bahasa Malaysia) via a `language` field on packs/users, passed into
  every prompt
- Async upload processing with startup reconciliation (an orphaned `PROCESSING` pack from a
  container restart gets marked `FAILED` on boot, not stuck forever) and hard timeouts around
  extraction/vision calls

## Not built yet (see `docs/MVP_PLAN.md` for the full list + reasoning)

- Real authentication — currently a dev-only `x-user-id` header against seeded demo users; must
  be replaced (Clerk/Auth0 with parent-mediated child accounts) before real user data is involved
- Flashcards / notes / mind-maps (Basic tier ships summary + quiz only)
- Per-student AI cost tracking (Xpoints ledger tracks spend, not $ cost or token counts)
- Stripe billing, vector search/embeddings, a real background job queue for uploads
- Full i18n coverage — most page copy added since the initial pass is still hardcoded English,
  not routed through the `t()` / `en.json` / `ms.json` layer

## Tech stack

- **apps/api** — Express + TypeScript, Prisma ORM over Postgres
- **apps/web** — Next.js (App Router), React, plain CSS design system (`apps/web/app/globals.css`)
- **LLM SDKs** — `@anthropic-ai/sdk`, `@google/generative-ai`, `openai`
- **PDF pipeline** — a Python `pdfplumber` subprocess (`apps/api/scripts/pdf_to_markdown.py`) for
  text/heading extraction, `unpdf` + `@napi-rs/canvas` for page-to-image rendering (visual
  captioning)
- **Deploy** — Docker Compose (Postgres + api + web), documented for an Azure VM; also
  documented as deployable to Azure App Service without Docker

## Repo layout

```
Ai-Tutor/
├── apps/
│   ├── api/
│   │   ├── prisma/schema.prisma       Data model — start here to understand what's persisted
│   │   ├── scripts/pdf_to_markdown.py  PDF → Markdown extraction (heading detection by font size)
│   │   └── src/
│   │       ├── routes/                 One file per resource area (admin, parent, content, chat, ...)
│   │       ├── services/llm/           The "AI Gateway": provider router, prompts, settings
│   │       ├── services/pdf.ts          Chapter splitting logic
│   │       ├── services/visualNotes.ts  PDF page rendering + vision captioning
│   │       └── lib/                     env config, crypto (credential encryption), timeouts
│   └── web/
│       └── app/
│           ├── admin/                  Admin dashboard, content review, Model Router Settings
│           ├── parent/                 Parent dashboard
│           └── student/                Student dashboards + chat
├── docs/                                MVP_PLAN.md, ARCHITECTURE.md, AZURE_DEPLOYMENT.md
├── docker-compose.yml                    Postgres + api + web, for local dev or a VM
└── .env.example
```

## Data model (one-liner per table)

| Model | Purpose |
|---|---|
| `Family`, `User` | A family and its members (`ADMIN` \| `PARENT` \| `STUDENT`) |
| `TutorPack` | Admin-owned course content; `tier` gates live AI chat; `publishedAt` gates student visibility |
| `Chapter` | A section of a Tutor Pack, with extracted content + generated summary |
| `Quiz`, `QuizAttempt` | Generated quiz questions, and each student's attempt/score |
| `ChatMessage` | Live tutor chat history, per student per chapter |
| `Enrollment` | Grants a student access to a published Tutor Pack |
| `XpointsLedger` | Per-student quota ledger (chat spend) |
| `ModelRouterSetting` | Admin-configured provider fallback order + enabled/disabled state |
| `ProviderCredential` | Encrypted API keys entered via the Model Router Settings UI |
| `PromptSetting` | Editable AI system prompts (see Model Router Settings above) |

Full field-level detail: `apps/api/prisma/schema.prisma`.

## Environment variables

All optional at startup — the app boots with zero configured; an admin can add provider API keys
from the Model Router Settings UI afterward. See `.env.example` for the authoritative list.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (set automatically by `docker-compose.yml` for the containerized Postgres) |
| `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | LLM provider keys — locks that provider to this value, taking precedence over a key entered in the admin UI |
| `MODEL_PROVIDER_ORDER` | Initial fallback priority, e.g. `anthropic,gemini,openai` (default) — can be changed at runtime via the UI afterward |
| `CREDENTIAL_ENCRYPTION_KEY` | Encrypts UI-entered API keys at rest; recommended for production (falls back to a `DATABASE_URL`-derived key otherwise) |
| `NEXT_PUBLIC_API_URL` | Baked into the web app's browser bundle at build time — must be an address the browser can reach, not `localhost`, when deploying to a VM |
| `PORT` | API listen port (default `4000`) |

## Quickstart — local dev with hot reload

```bash
cp .env.example .env
docker compose up -d postgres  # just the database
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api   # prints demo admin/parent/student user ids
npm run dev                    # api on :4000, web on :3000
```

Sign in as the **admin** id first to create + publish a Tutor Pack (and, if no `*_API_KEY` is
set in `.env`, add one from the Model Router Settings tab), then as the **parent** id to enroll
the student, then as the **student** id to use it.

## Quickstart — full stack in Docker (what's run in production, e.g. an Azure VM)

```bash
cp .env.example .env
docker compose up -d --build   # builds & runs postgres + api + web
docker compose exec api node dist/seed.js   # prints demo admin/parent/student user ids
```

Open http://localhost:3000 (or the VM's address) and paste one of the seeded user ids on the home
page. See `docs/AZURE_DEPLOYMENT.md` for VM-specific steps (public IP, firewall ports, etc).

## Known limitations to flag before relying on this in production

- No real authentication (see "Not built yet" above)
- If deploying via `docker-compose.yml`, do **not** expose Postgres's port (5432) to the public
  internet — the compose file's default credentials are not safe to expose; keep that port
  reachable only from inside the Docker network / VM
- i18n coverage is partial — check `apps/web/i18n/{en,ms}.json` against actual page copy before
  assuming full Bahasa Malaysia support
