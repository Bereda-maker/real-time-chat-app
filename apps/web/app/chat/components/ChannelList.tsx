```tsx
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

export default function ChannelList({
  activeChannelId,
}: {
  activeChannelId?: string;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    listChannels()
      .then((data) => {
        if (!mounted) return;

        setChannels(data || []);
      })
      .catch((error) => {
        console.error("Failed to load channels:", error);

        if (mounted) {
          setChannels([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return <p className="empty-hint">Loading chats…</p>;
  }

  if (channels.length === 0) {
    return (
      <p className="empty-hint">
        No chats yet. Click &quot;+ New&quot; to start.
      </p>
    );
  }

  return (
    <nav className="channel-list" aria-label="Chat channels">
      {channels.map((channel) => {
        const label = channel.is_group
          ? channel.name || "Group"
          : channel.display_name || "Direct Message";

        const isActive = channel.id === activeChannelId;

        return (
          <button
            key={channel.id}
            type="button"
            className={`channel-item ${
              isActive ? "active" : ""
            }`}
            onClick={() => router.push(`/chat/${channel.id}`)}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="avatar">
              {label[0]?.toUpperCase() ?? "?"}
            </div>

            <span className="channel-name">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```
