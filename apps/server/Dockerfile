# WebSocket connections need a host that keeps a process alive and holds a
# persistent connection open. This image is built for a container platform
# (Fly.io, Render, Railway, or any container host) — not for a serverless
# function runtime, which has no notion of an open socket idling between
# messages. See README "Deployment".
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

COPY . .

EXPOSE 3001
ENV PORT=3001

# Run migrations, then start the server. In a real multi-instance deploy,
# migrations should run once (a release step / job), not on every replica's
# boot — see DEPLOYMENT.md.
CMD ["sh", "-c", "bun run migrate && bun run start"]
