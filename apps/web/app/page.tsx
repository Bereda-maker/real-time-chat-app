"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createChannel, listChannels } from "../lib/api";

type Channel = { id: string; name: string | null; is_group: boolean };

export default function HomePage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(true);

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
    if (!newUsername.trim()) return;
    const channel = await createChannel([newUsername.trim()], false);
    router.push(`/chat/${channel.id}`);
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
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <button type="submit">Start chat</button>
        </form>
      </div>
    </div>
  );
}
