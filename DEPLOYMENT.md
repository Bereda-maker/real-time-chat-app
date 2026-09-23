# Deployment Guide

WebSocket connections need a process that stays alive and holds an open
socket. That's why this project deploys in **two different ways**:

- **`apps/server`** (Bun + Hono, holds the WebSockets) → a **container
  platform** (this guide uses **Fly.io**; Render or Railway work the same
  way — build from the included `Dockerfile`).
- **`apps/web`** (Next.js, makes outbound requests/WebSocket connections but
  doesn't need to hold anything open itself) → **Vercel**, or anywhere that
  serves Next.js.

You'll also need a managed Postgres and a managed Redis instance in
production (Fly Postgres, Supabase, Neon, Upstash Redis, Redis Cloud — any
of these work; the app only needs a `DATABASE_URL` and a `REDIS_URL`).

---

## 1. Provision Postgres and Redis

Pick any managed providers. You need two connection strings:

- `DATABASE_URL` — e.g. `postgres://user:pass@host:5432/dbname`
- `REDIS_URL` — e.g. `redis://default:pass@host:6379`

Quick options:
- **Postgres:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) (both have a generous free tier and give you a connection string immediately)
- **Redis:** [Upstash](https://upstash.com) (serverless Redis, free tier, gives you a `redis://` URL)

Keep both connection strings handy — you'll paste them into the backend's
environment variables in step 3.

## 2. Install the Fly.io CLI and log in

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

## 3. Deploy the backend (`apps/server`)

```bash
cd apps/server
fly launch --no-deploy
```

`fly launch` will detect the `Dockerfile` and ask a few questions:
- App name: anything unique, e.g. `your-chat-server`
- Region: pick one close to your users
- Don't let it provision its own Postgres/Redis if you already did step 1 — say no when asked

Set your environment variables as Fly secrets (never commit these):

```bash
fly secrets set \
  DATABASE_URL="postgres://..." \
  REDIS_URL="redis://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ALLOWED_ORIGINS="https://your-frontend.vercel.app"
```

Then deploy:

```bash
fly deploy
```

Fly gives you a URL like `https://your-chat-server.fly.dev`. **Important:**
Fly (and most container platforms) terminate TLS for you, so your WebSocket
URL from the browser will be `wss://your-chat-server.fly.dev`, not `ws://`.

Verify it's up:

```bash
curl https://your-chat-server.fly.dev/health
# {"ok":true}
```

## 4. Deploy the frontend (`apps/web`) to Vercel

```bash
cd apps/web
npm install -g vercel
vercel
```

Follow the prompts (link or create a project). Before the first real
deploy, set the two environment variables Vercel needs, either via the
dashboard (Project → Settings → Environment Variables) or the CLI:

```bash
vercel env add NEXT_PUBLIC_API_URL
# → https://your-chat-server.fly.dev

vercel env add NEXT_PUBLIC_WS_URL
# → wss://your-chat-server.fly.dev
```

Then deploy to production:

```bash
vercel --prod
```

## 5. Close the loop: update ALLOWED_ORIGINS

Once you know your real Vercel URL, make sure the backend's CORS/WS origin
check matches it exactly:

```bash
cd apps/server
fly secrets set ALLOWED_ORIGINS="https://your-actual-app.vercel.app"
```

## 6. Smoke test

1. Open your Vercel URL in two different browsers (or one normal + one
   incognito window).
2. Register two different usernames.
3. From one account, start a chat with the other account's username.
4. Send a message — it should appear on the other side in well under a
   second, with a typing indicator showing while you type.
5. Turn off wifi briefly on one side, type a message, turn wifi back on —
   it should send automatically once reconnected (this is the
   exponential-backoff-plus-queue behavior in `lib/useChatSocket.ts`).

## Scaling to multiple server instances

This is the whole point of the architecture (see README). On Fly, scale up:

```bash
fly scale count 2
```

Because message delivery goes through Redis pub/sub rather than an
in-memory broadcast, two users connected to *different* Fly machines will
still receive each other's messages instantly — this is exactly what
`apps/server/src/__tests__/cross-instance.test.ts` verifies before you ever
deploy.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR: type-checks and tests the
backend against real Postgres + Redis service containers, and lints/builds
the frontend. Once you're happy with the manual deploy above, you can wire
`fly deploy` and `vercel --prod` into that workflow (via `flyctl` and
`vercel` GitHub Actions) so pushes to `main` deploy automatically — left as
a next step since it needs your Fly/Vercel API tokens as repo secrets.
