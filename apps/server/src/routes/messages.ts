import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db";
import { requireAuth, type AuthVariables } from "../middleware";
import { isMember } from "./channels";

export const messageRoutes = new Hono<{ Variables: AuthVariables }>();
messageRoutes.use("*", requireAuth);

const historyQuerySchema = z.object({
  // Cursor is "<created_at ISO>_<id>" of the oldest message already loaded.
  // Cursor pagination (vs. OFFSET) keeps scroll-up performance constant as
  // a channel grows, because it seeks directly via the index instead of
  // re-counting and skipping rows on every page.
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
});

messageRoutes.get("/:channelId/messages", async (c) => {
  const userId = c.get("userId") as string;
  const channelId = c.req.param("channelId");

  if (!(await isMember(channelId, userId))) {
    return c.json({ error: "not a member of this channel" }, 403);
  }

  const parsed = historyQuerySchema.safeParse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { cursor, limit } = parsed.data;

  let rows;
  if (cursor) {
    const [createdAt, id] = cursor.split("_");
    rows = await sql`
      SELECT id, channel_id, sender_id, body, created_at
      FROM messages
      WHERE channel_id = ${channelId}
        AND (created_at, id) < (${createdAt}::timestamptz, ${id}::uuid)
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT id, channel_id, sender_id, body, created_at
      FROM messages
      WHERE channel_id = ${channelId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
  }

  const last = rows[rows.length - 1];
  const nextCursor = last ? `${last.created_at}_${last.id}` : null;

  return c.json({ messages: rows.reverse(), nextCursor });
});
