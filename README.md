# MYTAMAN AI Tutor

Bilingual (English / Bahasa Malaysia) AI tutor web app for MYTAMAN, built around **Tutor
Packs**: an admin builds and publishes a course (e.g. KSSM Form 1 Sejarah), parents enroll their
child in it, and the student works through AI-generated summaries, quizzes, and (on
Premium/X-Points packs) a live Socratic AI tutor chat. See `docs/MVP_PLAN.md` for the full
Phase 1 scope.

See:
- `docs/MVP_PLAN.md` — what's in scope for Phase 1 and why the rest was deferred
- `docs/ARCHITECTURE.md` — repo layout, request flow, data model, the Admin/Parent/Student split
- `docs/AZURE_DEPLOYMENT.md` — how to deploy this to Azure, either as plain App Services (no
  Docker) or via Docker on a VM

## Repo layout

```
apps/
├── api/   AI Gateway + backend (Express, TypeScript, Prisma/Postgres) — has a Dockerfile
└── web/    Admin / Parent / Student dashboards (Next.js) — has a Dockerfile
```

## Quickstart — local dev with hot reload

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY and/or GEMINI_API_KEY
docker compose up -d postgres  # just the database
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api   # prints demo admin/parent/student user ids
npm run dev                    # api on :4000, web on :3000
```

Sign in as the **admin** id first to create + publish a Tutor Pack, then as the **parent** id to
enroll the student, then as the **student** id to use it.

## Quickstart — full stack in Docker (what to run on the Azure VM)

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY and/or GEMINI_API_KEY, and NEXT_PUBLIC_API_URL if not localhost
docker compose up -d --build   # builds & runs postgres + api + web
docker compose exec api node dist/seed.js   # prints demo admin/parent/student user ids
```

Open http://localhost:3000 (or the VM's address) and paste one of the seeded user ids on the home
page. See `docs/AZURE_DEPLOYMENT.md` for the VM-specific steps (public IP, firewall ports, etc).
