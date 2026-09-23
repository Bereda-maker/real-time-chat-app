"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import NewChatModal from "./components/NewChatModal";
import ChannelList from "./components/ChannelList";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const params = useParams();

  return (
    <div className="chat-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Chats</h2>
          <button
            className="new-chat-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + New
          </button>
        </div>
        <ChannelList activeChannelId={params?.channelId as string | undefined} />
      </aside>

      <div className="main">{children}</div>

      {isModalOpen && <NewChatModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
