import { Hono } from "hono";
import { sql } from "../db";
import { requireAuth, type AuthVariables } from "../middleware";

export const userRoutes = new Hono<{ Variables: AuthVariables }>();
userRoutes.use("*", requireAuth);

// Get all users EXCEPT the currently logged-in user
userRoutes.get("/", async (c) => {
  const currentUserId = c.get("userId") as string;

  const users = await sql`
    SELECT id, username, created_at
    FROM users
    WHERE id != ${currentUserId}
    ORDER BY username ASC
  `;

  return c.json({ users });
});
