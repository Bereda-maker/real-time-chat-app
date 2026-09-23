import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db";
import { signAccessToken, signWsToken, verifyAccessToken } from "../auth";

export const authRoutes = new Hono();

const credentialsSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(200),
});

authRoutes.post("/register", async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { username, password } = parsed.data;

  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) return c.json({ error: "username taken" }, 409);

  const passwordHash = await Bun.password.hash(password);
  const [user] = await sql`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username
  `;

  const token = signAccessToken({ userId: user.id, username: user.username });
  return c.json({ token, user });
});

authRoutes.post("/login", async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { username, password } = parsed.data;

  const [user] = await sql`SELECT id, username, password_hash FROM users WHERE username = ${username}`;
  if (!user) return c.json({ error: "invalid credentials" }, 401);

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) return c.json({ error: "invalid credentials" }, 401);

  const token = signAccessToken({ userId: user.id, username: user.username });
  return c.json({ token, user: { id: user.id, username: user.username } });
});

// Exchange a normal access token for a short-lived (60s) WS-only token.
// See auth.ts for why this extra hop exists.
authRoutes.post("/ws-token", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "missing token" }, 401);

  try {
    const payload = verifyAccessToken(authHeader.slice("Bearer ".length));
    const wsToken = signWsToken(payload);
    return c.json({ wsToken });
  } catch {
    return c.json({ error: "invalid token" }, 401);
  }
});
