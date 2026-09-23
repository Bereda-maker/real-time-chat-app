"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDirectChannel, getUsers, listChannels } from "../lib/api";

type Channel = { id: string; name: string | null; is_group: boolean };

export default function HomePage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
      return;
    }
    listChannels()
      .then(setChannels)
      .finally(() => setLoading(false));
  }, [router]);

  async function startChannel(e: React.FormEvent) {
    e.preventDefault();
    const target = newUsername.trim();
    if (!target) return;

    try {
      const users = await getUsers();
      const targetUser = users.find((u) => u.username === target);

      if (!targetUser) {
        setError(`No user found with username "${target}"`);
        return;
      }

      const channel = await createDirectChannel(targetUser.id);
      router.push(`/chat/${channel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start chat");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1>Your channels</h1>
        <p className="sub">Sign in as another user in a second window to test live messaging.</p>

        {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

        {!loading && channels.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No channels yet — start one below.</p>
        )}

        {channels.map((c) => (
          <button
            key={c.id}
            className="channel-item"
            style={{ background: "var(--panel)", marginBottom: 6 }}
            onClick={() => router.push(`/chat/${c.id}`)}
          >
            {c.name ?? (c.is_group ? "Group channel" : "Direct message")}
          </button>
        ))}

        <form onSubmit={startChannel} style={{ marginTop: 20 }}>
          <input
            placeholder="Start a chat with username…"
            value={newUsername}
            onChange={(e) => {
              setNewUsername(e.target.value);
              if (error) setError(null);
            }}
          />
          <button type="submit">Start chat</button>
        </form>

        {error && (
          <p role="alert" style={{ color: "var(--danger, #f87171)", fontSize: "0.85rem", marginTop: 10 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
