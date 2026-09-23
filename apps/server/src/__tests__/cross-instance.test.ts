import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { sql } from "../db";
import { signWsToken } from "../auth";

// This is the test the book's chapter describes: two WebSocket connections
// against two genuinely separate server *processes* (not just two sockets
// on one process — that would never exercise the Redis fan-out path at
// all), sharing one Redis, proving a message sent on instance 1 reaches a
// client connected only to instance 2. A single-process implementation
// with an in-memory broadcast would pass a weaker version of this test
// and still be broken in production.
//
// Requires Postgres + Redis reachable via DATABASE_URL / REDIS_URL (see
// docker-compose.yml, or the "redis" + "postgres" service containers in
// .github/workflows/ci.yml).

const PORT_A = 3901;
const PORT_B = 3902;

let procA: ReturnType<typeof Bun.spawn>;
let procB: ReturnType<typeof Bun.spawn>;

async function waitForHealth(port: number, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server on :${port} never became healthy`);
}

beforeAll(async () => {
  const env = { ...process.env };

  procA = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: import.meta.dir + "/../..",
    env: { ...env, PORT: String(PORT_A) },
    stdout: "ignore",
    stderr: "inherit",
  });
  procB = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: import.meta.dir + "/../..",
    env: { ...env, PORT: String(PORT_B) },
    stdout: "ignore",
    stderr: "inherit",
  });

  await Promise.all([waitForHealth(PORT_A), waitForHealth(PORT_B)]);
}, 20_000);

afterAll(() => {
  procA?.kill();
  procB?.kill();
});

test("a message sent on instance A is delivered to a client connected only to instance B", async () => {
  const [userA] = await sql`
    INSERT INTO users (username, password_hash) VALUES ('cross_a', 'x')
    ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
    RETURNING id, username
  `;
  const [userB] = await sql`
    INSERT INTO users (username, password_hash) VALUES ('cross_b', 'x')
    ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
    RETURNING id, username
  `;
  const [channel] = await sql`INSERT INTO channels (is_group) VALUES (true) RETURNING id`;
  await sql`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${channel.id}, ${userA.id}), (${channel.id}, ${userB.id})
    ON CONFLICT DO NOTHING
  `;

  const tokenA = signWsToken({ userId: userA.id, username: userA.username });
  const tokenB = signWsToken({ userId: userB.id, username: userB.username });

  const wsA = new WebSocket(`ws://localhost:${PORT_A}/ws/${channel.id}?token=${tokenA}`);
  const wsB = new WebSocket(`ws://localhost:${PORT_B}/ws/${channel.id}?token=${tokenB}`);

  await Promise.all([
    new Promise((resolve) => wsA.addEventListener("open", resolve, { once: true })),
    new Promise((resolve) => wsB.addEventListener("open", resolve, { once: true })),
  ]);

  const receivedOnB = new Promise<any>((resolve) => {
    wsB.addEventListener("message", (evt) => {
      const msg = JSON.parse(String(evt.data));
      if (msg.type === "message") resolve(msg);
    });
  });

  wsA.send(JSON.stringify({ type: "message", channelId: channel.id, body: "hello from instance A" }));

  const msg = await receivedOnB;
  expect(msg.body).toBe("hello from instance A");
  expect(msg.senderId).toBe(userA.id);

  wsA.close();
  wsB.close();
});
