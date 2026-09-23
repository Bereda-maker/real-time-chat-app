const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://real-time-chat-app-azwu.onrender.com";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "login failed");
  return res.json() as Promise<{ token: string; user: { id: string; username: string } }>;
}

export async function register(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "registration failed");
  return res.json() as Promise<{ token: string; user: { id: string; username: string } }>;
}

export async function getWsToken() {
  const res = await fetch(`${API_URL}/auth/ws-token`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error("could not get ws token");
  return (await res.json()).wsToken as string;
}

export async function listChannels() {
  const res = await fetch(`${API_URL}/channels`, { headers: authHeaders() });
  if (!res.ok) throw new Error("could not list channels");
  return (await res.json()).channels;
}

export async function createChannel(memberUsernames: string[], isGroup: boolean, name?: string) {
  const res = await fetch(`${API_URL}/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ memberUsernames, isGroup, name }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "could not create channel");
  return (await res.json()).channel;
}

export async function getHistory(channelId: string, cursor?: string) {
  const url = new URL(`${API_URL}/channels/${channelId}/messages`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("could not load history");
  return res.json() as Promise<{ messages: any[]; nextCursor: string | null }>;
}
