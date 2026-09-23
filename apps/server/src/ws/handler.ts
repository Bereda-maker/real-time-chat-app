import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import sanitizeHtml from "sanitize-html";
import { randomUUID } from "node:crypto";
import { verifyWsToken } from "../auth";
import { sql } from "../db";
import { redisPub, redisSub, channelTopic, setTyping, clearTyping, markOnline } from "../redis";
import { isMember } from "../routes/channels";
import { RateLimiter } from "../rateLimit";

type ClientMessage =
  | { type: "message"; channelId: string; body: string; clientId?: string }
  | { type: "typing:start"; channelId: string }
  | { type: "typing:stop"; channelId: string };

type ServerMessage =
  | { type: "message"; id: string; channelId: string; senderId: string; body: string; createdAt: string; clientId?: string }
  | { type: "typing"; channelId: string; userId: string; isTyping: boolean }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "error"; error: string };

// Every server instance subscribes to Redis, not to other sockets directly.
// This is the whole trick that makes horizontal scaling work: instance 1
// never tries to reach Client B's socket (it can't — it doesn't hold it).
// It publishes to Redis; whichever instance *does* hold Client B's socket
// relays it. See README fig. 4.1.
const subscribedTopics = new Set<string>();
const topicListeners = new Map<string, Set<(msg: ServerMessage) => void>>();

async function ensureSubscribed(topic: string) {
  if (subscribedTopics.has(topic)) return;
  subscribedTopics.add(topic);
  await redisSub.subscribe(topic);
}

redisSub.on("message", (topic, raw) => {
  const listeners = topicListeners.get(topic);
  if (!listeners) return;
  const msg: ServerMessage = JSON.parse(raw);
  for (const send of listeners) send(msg);
});

function addListener(topic: string, fn: (msg: ServerMessage) => void) {
  if (!topicListeners.has(topic)) topicListeners.set(topic, new Set());
  topicListeners.get(topic)!.add(fn);
}

function removeListener(topic: string, fn: (msg: ServerMessage) => void) {
  topicListeners.get(topic)?.delete(fn);
}

export function createWsHandler() {
  return (c: Context) => {
    const token = c.req.query("token");
    let userId: string;
    let username: string;

    try {
      if (!token) throw new Error("missing token");
      const payload = verifyWsToken(token);
      userId = payload.userId;
      username = payload.username;
    } catch {
      // Reject the upgrade outright rather than accepting then closing —
      // avoids doing any per-connection setup for an unauthenticated caller.
      return { onOpen: (_evt: unknown, ws: WSContext) => ws.close(4001, "unauthenticated") };
    }

    // 20 messages / 10s per connection is generous for a human, tight for a bot.
    const sendLimiter = new RateLimiter(20, 10_000);
    const joinedChannels = new Set<string>();
    // Origin-connection id: lets us skip re-delivering a message to the
    // very socket that sent it, even though that socket is subscribed to
    // the same Redis topic as everyone else in the channel. Without this,
    // every message you send would visibly double up in your own UI.
    const connectionId = randomUUID();

    let onServerMessage: ((msg: ServerMessage) => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    return {
      async onOpen(_evt: unknown, ws: WSContext) {
        await markOnline(userId);
        broadcastPresence(userId, true);

        heartbeat = setInterval(() => markOnline(userId), 15_000);

        onServerMessage = (msg) => {
          if ((msg as any).originConnectionId === connectionId) return; // don't echo to origin
          ws.send(JSON.stringify(msg));
        };

        // Every connection cares about presence changes for people it
        // shares a channel with; for this project's scope we broadcast
        // presence to all connected clients rather than computing the
        // precise shared-channel audience server-side.
        await ensureSubscribed("presence:broadcast");
        addListener("presence:broadcast", onServerMessage);
      },

      async onMessage(evt: MessageEvent, ws: WSContext) {
        let parsed: ClientMessage;
        try {
          parsed = JSON.parse(String(evt.data));
        } catch {
          ws.send(JSON.stringify({ type: "error", error: "invalid json" } satisfies ServerMessage));
          return;
        }

        if (parsed.type === "message") {
          if (!sendLimiter.tryConsume()) {
            ws.send(JSON.stringify({ type: "error", error: "rate limited" } satisfies ServerMessage));
            return;
          }

          const { channelId } = parsed;
          if (!(await isMember(channelId, userId))) {
            ws.send(JSON.stringify({ type: "error", error: "not a channel member" } satisfies ServerMessage));
            return;
          }

          const body = sanitizeHtml(parsed.body ?? "", { allowedTags: [], allowedAttributes: {} }).trim();
          if (!body || body.length > 4000) {
            ws.send(JSON.stringify({ type: "error", error: "invalid message body" } satisfies ServerMessage));
            return;
          }

          const [row] = await sql`
            INSERT INTO messages (channel_id, sender_id, body)
            VALUES (${channelId}, ${userId}, ${body})
            RETURNING id, created_at
          `;

          const topic = channelTopic(channelId);
          await ensureSubscribed(topic);
          if (onServerMessage) addListener(topic, onServerMessage);
          joinedChannels.add(channelId);

          const outgoing: ServerMessage & { originConnectionId?: string } = {
            type: "message",
            id: row.id,
            channelId,
            senderId: userId,
            body,
            createdAt: row.created_at,
            clientId: parsed.clientId,
          };
          // Sender gets an immediate ack directly (not via the round-trip
          // through Redis) so their own UI reconciles fast; everyone else
          // gets it via the pub/sub fan-out.
          ws.send(JSON.stringify(outgoing));
          await redisPub.publish(topic, JSON.stringify({ ...outgoing, originConnectionId: connectionId }));
        } else if (parsed.type === "typing:start" || parsed.type === "typing:stop") {
          const { channelId } = parsed;
          const topic = channelTopic(channelId);
          await ensureSubscribed(topic);
          if (onServerMessage) addListener(topic, onServerMessage);
          joinedChannels.add(channelId);

          if (parsed.type === "typing:start") await setTyping(channelId, userId);
          else await clearTyping(channelId, userId);

          await redisPub.publish(
            topic,
            JSON.stringify({
              type: "typing",
              channelId,
              userId,
              isTyping: parsed.type === "typing:start",
              originConnectionId: connectionId,
            })
          );
        }
      },

      onClose() {
        if (heartbeat) clearInterval(heartbeat);
        if (onServerMessage) {
          for (const channelId of joinedChannels) {
            removeListener(channelTopic(channelId), onServerMessage);
          }
          removeListener("presence:broadcast", onServerMessage);
        }
        broadcastPresence(userId, false);
      },
    };
  };
}

async function broadcastPresence(userId: string, online: boolean) {
  // Presence is ephemeral and fans out the same way messages do: publish,
  // don't write directly to sockets you don't hold.
  await redisPub.publish("presence:broadcast", JSON.stringify({ type: "presence", userId, online }));
}
