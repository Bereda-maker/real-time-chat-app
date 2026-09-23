"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Channel = {
  id: string;
  name: string | null;
  is_group: boolean;
  display_name?: string; // We'll get this from the updated GET /api/channels
};

export default function ChannelList({ activeChannelId }: { activeChannelId?: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/channels")
      .then((res) => res.json())
      .then((data) => setChannels(data.channels || []))
      .catch(console.error);
  }, []);

  return (
    <nav className="channel-list">
      {channels.length === 0 ? (
        <p className="empty-hint">No chats yet. Click "+ New" to start.</p>
      ) : (
        channels.map((channel) => {
          // For DMs, the backend should return a display_name (the other user's username)
          const label = channel.is_group ? channel.name : channel.display_name || "Direct Message";
          
          return (
            <button
              key={channel.id}
              className={`channel-item ${channel.id === activeChannelId ? "active" : ""}`}
              onClick={() => router.push(`/chat/${channel.id}`)}
            >
              <div className="avatar">
                {label?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="channel-name">{label}</span>
            </button>
          );
        })
      )}
    </nav>
  );
}
