import { Hono } from "hono";
import { cors } from "hono/cors";
import { createBunWebSocket } from "hono/bun";
import { authRoutes } from "./routes/auth";
import { channelRoutes } from "./routes/channels";
import { messageRoutes } from "./routes/messages";
import { createWsHandler } from "./ws/handler";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",");
const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono();

app.use("*", cors({ origin: allowedOrigins, credentials: true }));

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/channels", channelRoutes);
app.route("/channels", messageRoutes); // mounts GET /channels/:id/messages

// Bun has native WebSocket support built into the runtime (no separate ws
// library, no separate process) — that's the specific reason this project
// picked Bun over Node for the backend. See README "Why this stack".
app.get("/ws/:channelId", upgradeWebSocket(createWsHandler()));

const port = Number(process.env.PORT ?? 3001);
console.log(`chat-server listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};
