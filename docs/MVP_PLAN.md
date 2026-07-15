# MYTAMAN AI Tutor — MVP Plan

Source: `MYTAMAN_AI_Tutor_concept_draft.docx` (concept + full target architecture), refined by
`MYTAMAN_AI_Tutor_concept_draft_v2.docx`. This document scopes down that architecture to what
Phase 1 (internal prototype) actually needs.

## v2 revision: Tutor Packs, tiers, and role separation

The v2 draft sharpened the product shape considerably — this repo now reflects it:

- **Three isolated dashboards**, not one app with role-gated links: Admin (ops), Parent (child
  progress), Student (daily progression).
- **Commercial product, three Tutor Pack tiers**: Basic (pre-generated content only — summary,
  quiz, flashcards, notes; *"80–90% of the experience"*), Premium (adds live AI chat, Socratic
  learning, final assessments), X-Points (pay-per-use live AI). Phase 1 builds Basic only, but
  the tier field and gating exist now so Premium/X-Points are additive, not a rework.
- **Content becomes admin-owned and reusable**, not family-owned: an admin builds and publishes
  a Tutor Pack once (e.g. KSSM Form 1 Sejarah); every family enrolls into the same published
  pack rather than each parent uploading their own PDF.
- **A publish gate**: nothing an admin generates is visible to a student until explicitly
  published — this is the "human review" step from the v1 doc's Content Management pipeline,
  made concrete.
- **"Measure AI cost per student"** — an explicit Phase 1 admin requirement (not yet built —
  see "What's deferred" below).

See `docs/ARCHITECTURE.md` for how these map onto the `TutorPack` / `Enrollment` / role model.

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

The v1 doc names 7 things to build first, now split by role per v2:

1. Admin uploads Form 1 Sejarah PDF and publishes it as a Tutor Pack
2. Generate chapter summaries (admin, pre-generated once)
3. Generate quizzes (admin, pre-generated once)
4. Student chats with AI tutor — gated to Premium/X-Points tier packs (Basic has no live AI)
5. Save progress
6. Parent sees weak chapters
7. Limit usage by Xpoints / quota (chat only, since Basic-tier content generation isn't
   billed per student)

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
| Docker on Azure Container Apps | Skip for MVP — both apps have Dockerfiles and run via `docker compose` directly on the Azure VM instead of Container Apps | Container Apps (auto-scaling, scale-to-zero, managed ingress) is worth setting up once there's real traffic; a single `docker compose up` on the VM is enough to run and demo Phase 1. Azure App Service without Docker (see `docs/AZURE_DEPLOYMENT.md` Option B) is also still a valid no-Docker path if preferred later. |
| Clerk / Auth0 | Skip — seeded demo users (admin, parent, student) with a dev-only auth header | Real auth (and definitely a child-safe, parent-mediated auth flow) is a dedicated piece of work; don't block the product loop on it. Must be replaced before any real user data is involved, including the ADMIN role. |
| Flashcards / notes / mind-maps | Skip for now — Basic tier ships summary + quiz only | Additive content types on top of the same publish pipeline; not required to prove the pack/enrollment/tier model works. |
| Per-student AI cost tracking | Skip for now — Xpoints ledger tracks spend, but not $ cost or token counts | A concrete v2 admin requirement, deferred as a fast-follow once the role/pack skeleton is stable. |
| Stripe billing | Skip — Xpoints are just an integer balance in Postgres, decremented per AI call | Matches "Later part of development: no need for now" in the doc. |
| Azure Blob Storage + CDN | Skip for MVP — uploaded PDF is parsed to text immediately and only the extracted text is persisted; the file itself is not retained | Removes a dependency (storage account + SDK) before it's needed. Add Blob Storage when re-processing of original files, previews, or non-PDF assets are required. |

## Data model (Postgres via Prisma)

`Family → User (ADMIN | PARENT | STUDENT)`; `TutorPack → Chapter → Quiz / QuizAttempt /
ChatMessage`; `Enrollment (family, student, tutorPack)` links the two; plus an `XpointsLedger`
for quota. See `apps/api/prisma/schema.prisma`.

## Phases (from the concept doc)

- **Phase 1 — Internal prototype** ← this repo's current focus
- Phase 2 — Form 1 Sejarah Tutor Pack (real content, human review step, KSSM/language/level selectors)
- Phase 3 — Parent dashboard (richer analytics)
- Phase 4 — Xpoints billing (real payments, Stripe)
- Phase 5 — Add more subjects
- Phase 6 — School / tuition centre package

## Golden path this MVP proves end-to-end

1. Seeded admin uploads a PDF → API extracts text and splits it into naive chapters, creating a
   draft Tutor Pack.
2. Admin generates a summary and quiz per chapter via the model router, then publishes the pack.
3. Seeded parent browses published packs and enrolls their (seeded) child.
4. Seeded student opens an enrolled pack's chapter, reads the summary, and takes the quiz. If
   the pack's tier is Premium/X-Points, they can also chat with the AI tutor (Socratic — the
   prompt template asks guiding questions instead of giving answers outright); on a Basic-tier
   pack, chat is blocked with a clear "Premium feature" message.
5. Quiz attempts and chat activity are saved as progress; each chat message deducts Xpoints and
   is blocked once the balance hits zero (Basic-tier content generation is not billed to the
   student — it's a one-time admin/platform cost).
6. Parent dashboard aggregates quiz scores per chapter to surface weak topics.
