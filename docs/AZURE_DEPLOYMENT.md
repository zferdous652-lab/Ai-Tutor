# Deploying the MVP to Azure

Two ways to run this on Azure. Both are documented; pick based on what you want right now.

- **Docker on the VM** (this section) — run `docker compose up` directly on your Azure VM. Gives
  you the fastest way to see the whole stack (web + api + Postgres) running and click through it
  yourself. Use this now.
- **Azure App Service, no Docker** (further down) — deploy each app straight from GitHub with no
  containers at all. A reasonable option later if you'd rather not manage a VM's OS/patching/
  Docker daemon yourself, but not required — Docker on the VM is a fully valid way to run
  Phase 1 in production too.

## Option A — Docker Compose on your Azure VM

This repo's root `docker-compose.yml` builds and runs all three pieces: Postgres, the API
(AI Gateway), and the Next.js web app.

### One-time VM setup

1. SSH into the VM.
2. Install Docker Engine + the Compose plugin (Docker isn't set up yet, per your note):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out/in again after this
   ```
3. Open the VM's Network Security Group to allow inbound TCP on **3000** (web) and, if you want
   to hit the API directly for debugging, **4000**. Do **not** expose 5432 (Postgres) publicly.
4. Clone this repo onto the VM and check out this branch:
   ```bash
   git clone https://github.com/zferdous652-lab/Ai-Tutor.git
   cd Ai-Tutor
   git checkout claude/project-structure-mvp-plan-fgk1xu
   ```

### Configure and run

```bash
cp .env.example .env
```

Edit `.env`:
- `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` — set at least one, or the `api` container exits
  immediately with a clear error. With both set, `MODEL_PROVIDER_ORDER` (default
  `anthropic,gemini`) picks the priority order, and the model router automatically falls back to
  the second provider if the first one rate-limits or errors — see `docs/ARCHITECTURE.md`.
- `NEXT_PUBLIC_API_URL` — **set this to `http://<VM_PUBLIC_IP>:4000`**, not `localhost`. This value
  gets baked into the browser JavaScript bundle at build time, so it has to be an address your
  laptop's browser can actually reach — `localhost` would resolve to the visitor's own machine,
  not the VM.

```bash
docker compose up -d --build
docker compose exec api node dist/seed.js   # one-time: creates the demo family, prints user ids
```

Then open `http://<VM_PUBLIC_IP>:3000` in your browser, paste one of the printed user ids on the
home page, and use **Upload** (as the parent id) to add a PDF, then the printed **student** id to
chat with the tutor and take the quiz, and **Parent Dashboard** (as the parent id) to see weak
chapters and Xpoints usage.

### Day-to-day

```bash
docker compose logs -f api web   # tail logs
docker compose up -d --build      # rebuild + restart after pulling new commits
docker compose down                # stop everything (data persists in the postgres-data volume)
```

If you change `NEXT_PUBLIC_API_URL` in `.env`, you must rebuild the `web` image
(`docker compose up -d --build web`) — it won't pick up the change from a restart alone, since
it's compiled into the bundle at build time.

## Option B — Azure App Service, no Docker

| Component | Azure service | Why |
|---|---|---|
| `apps/web` (Next.js) | App Service (Linux, Node 20) | PaaS, deploy from GitHub, managed SSL/scaling, no Docker |
| `apps/api` (Express) | App Service (Linux, Node 20) — separate app from `web` | Same as above; keep it a separate App Service so it scales/restarts independently of the frontend |
| Database | Azure Database for PostgreSQL — Flexible Server (Burstable B1ms is enough to start) | Managed Postgres, matches the doc's recommendation, no server to patch |

### One-time setup

1. **Resource group** — create one (e.g. `mytaman-ai-tutor-rg`) to hold everything below.
2. **Postgres**: Azure Database for PostgreSQL Flexible Server → note the connection string →
   this becomes `DATABASE_URL`.
3. **Two App Services** (both Linux, Node 20 LTS, same resource group/plan is fine to start):
   - `mytaman-api` → deploys `apps/api`
   - `mytaman-web` → deploys `apps/web`
4. **App settings** (Configuration → Application settings) on `mytaman-api`:
   - `DATABASE_URL` — from step 2
   - `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` — at least one required
   - `PORT` — `8080` (App Service's expected port; Express reads `process.env.PORT`)
5. **App settings** on `mytaman-web`:
   - `NEXT_PUBLIC_API_URL` — the `mytaman-api` App Service URL (e.g. `https://mytaman-api.azurewebsites.net`)

### Deploying

Simplest path: connect each App Service to this GitHub repo (Deployment Center → GitHub) and set:
- `mytaman-api` → build from `apps/api`, startup command `npm run start`
- `mytaman-web` → build from `apps/web`, startup command `npm run start`

App Service's Oryx builder detects Node automatically and runs `npm install && npm run build`
before `npm run start`, using each app's own `package.json` (Prisma's `postinstall` will run
`prisma generate`, and you'll need to run `npx prisma migrate deploy` once against the production
`DATABASE_URL` after the first deploy — either via the App Service SSH console or a one-off local
run pointed at the production connection string).

## Local development (no Azure needed)

```bash
cp .env.example .env        # fill in ANTHROPIC_API_KEY and/or GEMINI_API_KEY
docker compose up -d postgres  # starts Postgres only
npm install
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api
npm run dev                  # runs api (:4000) and web (:3000) together, with hot reload
```

Or run the exact same containers you'd run on the VM: `docker compose up -d --build` (no
`postgres`-only flag) and seed with `docker compose exec api node dist/seed.js`.
