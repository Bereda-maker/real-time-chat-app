import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db";
import { requireAuth, type AuthVariables } from "../middleware";

export const channelRoutes = new Hono<{ Variables: AuthVariables }>();
channelRoutes.use("*", requireAuth);

// List channels the authenticated user belongs to.
channelRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const channels = await sql`
    SELECT c.id, c.name, c.is_group, c.created_at
    FROM channels c
    JOIN channel_members m ON m.channel_id = c.id
    WHERE m.user_id = ${userId}
    ORDER BY c.created_at DESC
  `;
  return c.json({ channels });
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isGroup: z.boolean().default(false),
  memberUsernames: z.array(z.string()).min(1),
});

channelRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const parsed = createChannelSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { name, isGroup, memberUsernames } = parsed.data;

  const members = await sql`
    SELECT id FROM users WHERE username = ANY(${memberUsernames})
  `;
  if (members.length !== memberUsernames.length) {
    return c.json({ error: "one or more usernames not found" }, 404);
  }

  const channel = await sql.begin(async (tx) => {
    const [channel] = await tx`
      INSERT INTO channels (name, is_group) VALUES (${name ?? null}, ${isGroup})
      RETURNING id, name, is_group, created_at
    `;
    const memberIds = [userId, ...members.map((m) => m.id)];
    for (const memberId of memberIds) {
      await tx`
        INSERT INTO channel_members (channel_id, user_id)
        VALUES (${channel.id}, ${memberId})
        ON CONFLICT DO NOTHING
      `;
    }
    return channel;
  });

  return c.json({ channel }, 201);
});

async function isMember(channelId: string, userId: string) {
  const rows = await sql`
    SELECT 1 FROM channel_members WHERE channel_id = ${channelId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

export { isMember };
