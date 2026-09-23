# Real-Time Chat Application

Project 4 of "Build 10 Real-World Projects" — messaging that stays fast and
correct once there's more than one server process handling connections.

**Stack:** TypeScript · Next.js (frontend) · Hono + Bun (WebSocket backend) ·
PostgreSQL (durable state) · Redis pub/sub (cross-instance fan-out + ephemeral
presence/typing state)

## Why this architecture

A single in-memory WebSocket server works fine locally and breaks the moment
you run two instances behind a load balancer: a message from Client A on
instance 1 has no way to reach Client B, who's connected to instance 2.

This project fixes that with Redis pub/sub:

```
Client A ──▶ Bun instance 1 ──▶ Redis channel:<id> ──▶ Bun instance 2 ──▶ Client B
```

Every server instance subscribes to the Redis channel for every channel a
locally-connected client cares about. When instance 1 receives a message, it
persists it to Postgres and **publishes** it to Redis — it does not write
directly to Client B's socket, because it has no socket for Client B.
Instance 2, subscribed to the same Redis channel, relays the message to
Client B. This is what makes the system correct under horizontal scaling.

**Durable vs. ephemeral state** (the single most common real-time-systems
mistake): anything that must survive a restart (messages, channel
membership) lives in Postgres. Anything ephemeral (who's typing right now,
who's online right now) lives only in Redis, with a short TTL.

## Project layout

```
apps/
  server/   Hono + Bun WebSocket API, Postgres persistence, Redis pub/sub
  web/      Next.js frontend
docker-compose.yml   Postgres + Redis for local dev
.github/workflows/ci.yml   CI: spins up Postgres + Redis service containers
```

## Requirements implemented

- 1:1 and group channels with persisted, paginated message history
- Typing indicators and online/offline presence (Redis, TTL-based, never
  written to Postgres)
- Correct behavior across multiple horizontally-scaled server instances via
  Redis pub/sub — verified by an integration test that opens two WebSocket
  connections routed through two independent server instances
- Client reconnects with exponential backoff after a dropped connection, and
  queues outgoing messages sent while disconnected, replaying them once
  reconnected
- Cursor-based (not offset-based) history pagination
- Per-connection rate limiting and server-side message sanitization
  (stored-XSS prevention)
- "Don't echo to origin" — a message is not re-delivered to the socket that
  sent it, even though that socket is also subscribed to the channel
- New messages announced via an ARIA live region for screen readers

## Local development

Requires [Bun](https://bun.sh) and [Docker](https://docker.com).

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install & run the backend
cd apps/server
bun install
bun run migrate   # applies migrations/001_init.sql
bun run dev        # http://localhost:3001

# 3. Install & run the frontend (separate terminal)
cd apps/web
npm install
npm run dev         # http://localhost:3000
```

Open two browser windows (or one normal + one incognito) as two different
users to see live messaging, typing indicators, and presence.

## Deployment

**WebSocket connections need a host that keeps a process alive and holds a
persistent connection open.** Standard serverless functions (as used for
earlier, request/response-only projects in this series) cannot do this — a
request-scoped function has no notion of an open socket sitting idle between
messages. This project deploys the backend to a **container platform**
instead (Fly.io, Render, Railway, or a container on AWS/GCP/Azure), and the
frontend can still deploy anywhere that serves a Next.js app (Vercel works
fine — it only makes outbound WebSocket connections to the backend, it
doesn't need to hold them open itself).

See `DEPLOYMENT.md` for the full step-by-step guide.

## Testing

```bash
cd apps/server
bun test
```

The key integration test (`src/__tests__/cross-instance.test.ts`) starts two
independent server instances sharing the same Redis, opens a WebSocket to
each as a different client, and asserts a message sent to instance 1 is
received by the client connected to instance 2 — the exact scenario a
single-instance-only implementation would fail.

## License

MIT — built for educational purposes as part of a "Build 10 Real-World
Projects" learning series.
