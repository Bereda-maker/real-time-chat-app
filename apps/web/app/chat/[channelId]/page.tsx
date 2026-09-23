"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getHistory, getWsToken, getChannel } from "../../../lib/api"; // Add getChannel to your api lib
import { useChatSocket, type ChatMessage } from "../../../lib/useChatSocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export default function ChatPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const router = useRouter();

  const [wsToken, setWsToken] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  
  // NEW: State to store channel info (like the other user's name for the header)
  const [channelInfo, setChannelInfo] = useState<{ name: string; is_group: boolean } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setUserId(localStorage.getItem("userId"));
    getWsToken().then(setWsToken).catch(() => router.push("/login"));

    // NEW: Fetch channel details for the header
    getChannel(channelId)
      .then((data) => setChannelInfo(data.channel))
      .catch(() => router.push("/chat"));
  }, [router, channelId]);

  const { connected, messages, setMessages, typingUsers, sendMessage, setTyping } = useChatSocket(
    WS_URL,
    channelId,
    wsToken
  );

  // ... (Rest of your existing logic for history, loadMore, onSend, onDraftChange stays the same)
  
  // Your existing useEffect for history
  useEffect(() => {
    if (!channelId) return;
    getHistory(channelId).then(({ messages: history, nextCursor }) => {
      setMessages(history);
      setNextCursor(nextCursor);
    });
  }, [channelId, setMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const prevHeight = listRef.current?.scrollHeight ?? 0;
    const { messages: older, nextCursor: newCursor } = await getHistory(channelId, nextCursor);
    setMessages((prev) => [...older, ...prev]);
    setNextCursor(newCursor);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight - prevHeight;
      }
    });
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const optimistic: ChatMessage = {
      type: "message",
      id: `pending-${Date.now()}`,
      clientId: crypto.randomUUID(),
      channelId,
      senderId: userId ?? "me",
      body,
      createdAt: new Date().toISOString(),
    };
    sendMessage(body, optimistic);
    setDraft("");
    setTyping(false);
  }

  function onDraftChange(value: string) {
    setDraft(value);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  }

  const othersTyping = [...typingUsers].filter((id) => id !== userId);

  // Figure out the header label
  const headerLabel = channelInfo 
    ? (channelInfo.is_group ? channelInfo.name : "Direct Message") 
    : "Loading...";

  return (
    <>
      <div className="topbar">
        <strong>{headerLabel}</strong>
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
          {connected ? "Connected" : "Reconnecting…"}
        </span>
      </div>

      <div className="message-list" ref={listRef}>
        {nextCursor && (
          <button className="load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        {messages.map((m) => (
          <div key={m.clientId ?? m.id} className={`bubble-row ${m.senderId === userId ? "mine" : ""}`}>
            <div className={`bubble ${m.id.startsWith("pending-") ? "pending" : ""}`}>
              {m.body}
              <div className="meta">{new Date(m.createdAt).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}

        <div aria-live="polite" className="sr-only">
          {messages.length > 0 && `New message: ${messages[messages.length - 1].body}`}
        </div>
      </div>

      <div className="typing-indicator">
        {othersTyping.length > 0 && (othersTyping.length === 1 ? "Someone is typing…" : "Several people are typing…")}
      </div>

      <form className="composer" onSubmit={onSend}>
        <input
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
