"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listChannels } from "../lib/api";
import NewChatModal from "./chat/components/NewChatModal";

type Channel = { id: string; name: string | null; is_group: boolean };

export default function HomePage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
      return;
    }
    listChannels()
      .then(setChannels)
      .finally(() => setLoading(false));
  }, [router]);

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

        <button type="button" style={{ marginTop: 20 }} onClick={() => setIsModalOpen(true)}>
          + Start a new chat
        </button>
      </div>

      {isModalOpen && <NewChatModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

