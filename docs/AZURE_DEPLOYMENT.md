# Deploying the MVP to Azure (no Docker required)

You mentioned Docker isn't set up on your Azure VM yet. Good news: the MVP doesn't need it. Both
apps in this repo run on plain Node.js, so **Azure App Service (Linux, Node runtime)** can deploy
straight from GitHub with no container involved. Docker only becomes worth setting up later, when
the AI Gateway is split into its own containerized service (Phase 2+ — see `docs/MVP_PLAN.md`).

## Recommended Phase 1 setup

| Component | Azure service | Why |
|---|---|---|
| `apps/web` (Next.js) | App Service (Linux, Node 20) | PaaS, deploy from GitHub, managed SSL/scaling, no Docker |
| `apps/api` (Express) | App Service (Linux, Node 20) — separate app from `web` | Same as above; keep it a separate App Service so it scales/restarts independently of the frontend |
| Database | Azure Database for PostgreSQL — Flexible Server (Burstable B1ms is enough to start) | Managed Postgres, matches the doc's recommendation, no server to patch |
| File storage | None yet | MVP parses the uploaded PDF to text immediately and doesn't keep the original file — nothing to store. Add Blob Storage when you need to keep source files. |

You will **not** need: Redis, N8N, Azure Container Apps, or Blob Storage for Phase 1.

## One-time setup

1. **Resource group** — create one (e.g. `mytaman-ai-tutor-rg`) to hold everything below.
2. **Postgres**: Azure Database for PostgreSQL Flexible Server → note the connection string →
   this becomes `DATABASE_URL`.
3. **Two App Services** (both Linux, Node 20 LTS, same resource group/plan is fine to start):
   - `mytaman-api` → deploys `apps/api`
   - `mytaman-web` → deploys `apps/web`
4. **App settings** (Configuration → Application settings) on `mytaman-api`:
   - `DATABASE_URL` — from step 2
   - `ANTHROPIC_API_KEY` — your Claude API key
   - `PORT` — `8080` (App Service's expected port; Express reads `process.env.PORT`)
5. **App settings** on `mytaman-web`:
   - `NEXT_PUBLIC_API_URL` — the `mytaman-api` App Service URL (e.g. `https://mytaman-api.azurewebsites.net`)

## Deploying

Simplest path: connect each App Service to this GitHub repo (Deployment Center → GitHub) and set:
- `mytaman-api` → build from `apps/api`, startup command `npm run start`
- `mytaman-web` → build from `apps/web`, startup command `npm run start`

App Service's Oryx builder detects Node automatically and runs `npm install && npm run build`
before `npm run start`, using each app's own `package.json` (Prisma's `postinstall` will run
`prisma generate`, and you'll need to run `npx prisma migrate deploy` once against the production
`DATABASE_URL` after the first deploy — either via the App Service SSH console or a one-off local
run pointed at the production connection string).

## Migrating to Docker later (Phase 2+)

When you're ready to containerize (e.g. once the AI Gateway needs background workers, Redis, or
you want Azure Container Apps' scale-to-zero), `apps/api` is the piece to containerize first — it
has no dependency on App Service-specific behavior. `docker-compose.yml` in this repo already
shows the local shape (Postgres + api); adding a `Dockerfile` to `apps/api` and pushing it to
Azure Container Registry → Container Apps is a self-contained follow-up task that doesn't require
changing `apps/web`.

## Local development (no Azure needed)

```bash
cp .env.example .env        # fill in ANTHROPIC_API_KEY
docker compose up -d         # starts Postgres only
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api
npm run dev                  # runs api (:4000) and web (:3000) together
```
