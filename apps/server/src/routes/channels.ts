import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db";
import { requireAuth, type AuthVariables } from "../middleware";

export const channelRoutes = new Hono<{ Variables: AuthVariables }>();
channelRoutes.use("*", requireAuth);

// ---------------------------------------------------------------------------
// GET /api/channels
// List all channels the authenticated user belongs to.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GET /api/channels/:id
// Get details of a single channel (must be a member).
// Useful for the chat header to display the other user's name.
// ---------------------------------------------------------------------------
channelRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const channelId = c.req.param("id");

  if (!(await isMember(channelId, userId))) {
    return c.json({ error: "not a member of this channel" }, 403);
  }

  const [channel] = await sql`
    SELECT id, name, is_group, created_at
    FROM channels
    WHERE id = ${channelId}
  `;

  if (!channel) return c.json({ error: "channel not found" }, 404);

  // Fetch members (usernames) so the frontend can render the header
  const members = await sql`
    SELECT u.id, u.username
    FROM users u
    JOIN channel_members m ON m.user_id = u.id
    WHERE m.channel_id = ${channelId}
  `;

  return c.json({ channel: { ...channel, members } });
});

// ---------------------------------------------------------------------------
// POST /api/channels/direct
// Get an existing 1-on-1 DM or create a new one.
// Body: { targetUserId: string }
// ---------------------------------------------------------------------------
const createDMSchema = z.object({
  targetUserId: z.string().uuid(), // adjust if you use a different ID format
});

channelRoutes.post("/direct", async (c) => {
  const userId = c.get("userId") as string;
  const parsed = createDMSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { targetUserId } = parsed.data;

  if (userId === targetUserId) {
    return c.json({ error: "cannot create a DM with yourself" }, 400);
  }

  // Check the target user actually exists
  const [targetUser] = await sql`
    SELECT id FROM users WHERE id = ${targetUserId}
  `;
  if (!targetUser) return c.json({ error: "target user not found" }, 404);

  // 1. Look for an existing 1-on-1 channel between these two users
  const existing = await sql`
    SELECT c.id, c.name, c.is_group, c.created_at
    FROM channels c
    JOIN channel_members m1 ON m1.channel_id = c.id AND m1.user_id = ${userId}
    JOIN channel_members m2 ON m2.channel_id = c.id AND m2.user_id = ${targetUserId}
    WHERE c.is_group = false
    LIMIT 1
  `;

  if (existing.length > 0) {
    return c.json({ channel: existing[0] });
  }

  // 2. Create a new DM channel
  const channel = await sql.begin(async (tx) => {
    const [newChannel] = await tx`
      INSERT INTO channels (name, is_group)
      VALUES (NULL, false)
      RETURNING id, name, is_group, created_at
    `;

    await tx`
      INSERT INTO channel_members (channel_id, user_id)
      VALUES
        (${newChannel.id}, ${userId}),
        (${newChannel.id}, ${targetUserId})
      ON CONFLICT DO NOTHING
    `;

    return newChannel;
  });

  return c.json({ channel }, 201);
});

// ---------------------------------------------------------------------------
// POST /api/channels/group
// Create a group channel with multiple members (by username).
// Body: { name?: string, memberUsernames: string[] }
// ---------------------------------------------------------------------------
const createGroupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  memberUsernames: z.array(z.string()).min(1),
});

channelRoutes.post("/group", async (c) => {
  const userId = c.get("userId") as string;
  const parsed = createGroupSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { name, memberUsernames } = parsed.data;

  const members = await sql`
    SELECT id FROM users WHERE username = ANY(${memberUsernames})
  `;
  if (members.length !== memberUsernames.length) {
    return c.json({ error: "one or more usernames not found" }, 404);
  }

  const channel = await sql.begin(async (tx) => {
    const [newChannel] = await tx`
      INSERT INTO channels (name, is_group)
      VALUES (${name ?? null}, true)
      RETURNING id, name, is_group, created_at
    `;

    const memberIds = [userId, ...members.map((m) => m.id)];
    for (const memberId of memberIds) {
      await tx`
        INSERT INTO channel_members (channel_id, user_id)
        VALUES (${newChannel.id}, ${memberId})
        ON CONFLICT DO NOTHING
      `;
    }

    return newChannel;
  });

  return c.json({ channel }, 201);
});

// ---------------------------------------------------------------------------
// Helper: check if a user belongs to a channel
// ---------------------------------------------------------------------------
async function isMember(channelId: string, userId: string) {
  const rows = await sql`
    SELECT 1 FROM channel_members
    WHERE channel_id = ${channelId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

export { isMember };
