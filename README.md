# MYTAMAN AI Tutor

Bilingual (English / Bahasa Malaysia) AI tutor web app for MYTAMAN. This repo currently
implements the **Phase 1 MVP** described in `docs/MVP_PLAN.md`: upload a textbook PDF, generate
chapter summaries and quizzes, let a student chat with a Socratic AI tutor and take quizzes, save
progress, surface weak chapters to a parent dashboard, and cap usage with an Xpoints quota.

See:
- `docs/MVP_PLAN.md` — what's in scope for Phase 1 and why the rest was deferred
- `docs/ARCHITECTURE.md` — repo layout, request flow, data model
- `docs/AZURE_DEPLOYMENT.md` — how to deploy this to Azure, either as plain App Services (no
  Docker) or via Docker on a VM

## Repo layout

```
apps/
├── api/   AI Gateway + backend (Express, TypeScript, Prisma/Postgres) — has a Dockerfile
└── web/    Student App + Parent Dashboard (Next.js) — has a Dockerfile
```

## Quickstart — local dev with hot reload

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY and/or GEMINI_API_KEY
docker compose up -d postgres  # just the database
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api   # prints demo parent/student user ids
npm run dev                    # api on :4000, web on :3000
```

## Quickstart — full stack in Docker (what to run on the Azure VM)

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY and/or GEMINI_API_KEY, and NEXT_PUBLIC_API_URL if not localhost
docker compose up -d --build   # builds & runs postgres + api + web
docker compose exec api node dist/seed.js   # prints demo user ids
```

Open http://localhost:3000 (or the VM's address) and paste one of the seeded user ids on the home
page. See `docs/AZURE_DEPLOYMENT.md` for the VM-specific steps (public IP, firewall ports, etc).
