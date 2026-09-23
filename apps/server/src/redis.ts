import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ioredis requires a dedicated connection for subscribe mode — you can't
// issue normal commands (SET, PUBLISH) on a connection that's in
// subscriber mode. Hence two clients: one to publish + store ephemeral
// state, one purely to subscribe.
export const redisPub = new Redis(REDIS_URL);
export const redisSub = new Redis(REDIS_URL);

const TYPING_TTL_SECONDS = 6; // auto-clears if a "stopped typing" event is lost
const PRESENCE_TTL_SECONDS = 30; // client heartbeats faster than this

export function channelTopic(channelId: string) {
  return `channel:${channelId}`;
}

export async function setTyping(channelId: string, userId: string) {
  await redisPub.set(`typing:${channelId}:${userId}`, "1", "EX", TYPING_TTL_SECONDS);
}

export async function clearTyping(channelId: string, userId: string) {
  await redisPub.del(`typing:${channelId}:${userId}`);
}

export async function markOnline(userId: string) {
  await redisPub.set(`presence:${userId}`, "1", "EX", PRESENCE_TTL_SECONDS);
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await redisPub.exists(`presence:${userId}`)) === 1;
}
