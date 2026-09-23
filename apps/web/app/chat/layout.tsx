"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import NewChatModal from "./components/NewChatModal";
import ChannelList from "./components/ChannelList"; // We'll build this next

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const params = useParams();

  return (
    <div className="chat-shell">
      {/* Sidebar */}
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
        
        {/* This component fetches and renders the list of channels */}
        <ChannelList activeChannelId={params.channelId as string} />
      </aside>

      {/* Main content area (either empty state or the actual chat) */}
      <div className="main">
        {children}
      </div>

      {isModalOpen && <NewChatModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
