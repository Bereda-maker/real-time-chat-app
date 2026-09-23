import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export type AccessTokenPayload = { userId: string; username: string };
export type WsTokenPayload = { userId: string; username: string; type: "ws" };

// Normal HTTP requests can rely on an httpOnly cookie. A cross-origin
// WebSocket upgrade cannot attach a cookie the same way a fetch() can
// (browsers don't send SameSite cookies on the initial WS handshake across
// origins in the same way), so the client exchanges its session for a
// short-lived, single-purpose token first, then passes that token as a
// query param on the WS connection.
export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function signWsToken(payload: AccessTokenPayload) {
  return jwt.sign({ ...payload, type: "ws" }, JWT_SECRET, { expiresIn: "60s" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export function verifyWsToken(token: string): WsTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as WsTokenPayload;
  if (decoded.type !== "ws") throw new Error("not a ws token");
  return decoded;
}
