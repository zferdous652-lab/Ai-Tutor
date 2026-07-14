# MYTAMAN AI Tutor

Bilingual (English / Bahasa Malaysia) AI tutor web app for MYTAMAN. This repo currently
implements the **Phase 1 MVP** described in `docs/MVP_PLAN.md`: upload a textbook PDF, generate
chapter summaries and quizzes, let a student chat with a Socratic AI tutor and take quizzes, save
progress, surface weak chapters to a parent dashboard, and cap usage with an Xpoints quota.

See:
- `docs/MVP_PLAN.md` — what's in scope for Phase 1 and why the rest was deferred
- `docs/ARCHITECTURE.md` — repo layout, request flow, data model
- `docs/AZURE_DEPLOYMENT.md` — how to deploy this to Azure **without Docker**

## Repo layout

```
apps/
├── api/   AI Gateway + backend (Express, TypeScript, Prisma/Postgres)
└── web/    Student App + Parent Dashboard (Next.js)
```

## Quickstart (local dev)

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY
docker compose up -d           # Postgres only
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api   # prints demo parent/student user ids
npm run dev                    # api on :4000, web on :3000
```

Open http://localhost:3000, paste one of the seeded user ids on the home page, then use
**Upload** (as the parent id) and **Parent Dashboard** / chapter chat+quiz (as the student id).
