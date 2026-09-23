import type { Context, Next } from "hono";
import { verifyAccessToken } from "./auth";

export type AuthVariables = { userId: string; username: string };

export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    const payload = verifyAccessToken(authHeader.slice("Bearer ".length));
    c.set("userId", payload.userId);
    c.set("username", payload.username);
    await next();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
}
