"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listChannels } from "../../../lib/api";

type Channel = {
  id: string;
  name: string | null;
  is_group: boolean;
  display_name?: string;
};

export default function ChannelList({ activeChannelId }: { activeChannelId?: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    listChannels()
      .then((data) => {
        setChannels(data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p className="empty-hint">Loading chats…</p>;

  if (channels.length === 0) {
    return <p className="empty-hint">No chats yet. Click "+ New" to start.</p>;
  }

  return (
    <nav className="channel-list">
      {channels.map((channel) => {
        const label = channel.is_group
          ? channel.name || "Group"
          : channel.display_name || "Direct Message";

        return (
          <button
            key={channel.id}
            className={`channel-item ${channel.id === activeChannelId ? "active" : ""}`}
            onClick={() => router.push(`/chat/${channel.id}`)}
          >
            <div className="avatar">{label[0]?.toUpperCase() ?? "?"}</div>
            <span className="channel-name">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
