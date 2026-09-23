"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  type: "message";
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  clientId?: string;
};

export type TypingEvent = { type: "typing"; channelId: string; userId: string; isTyping: boolean };
export type PresenceEvent = { type: "presence"; userId: string; online: boolean };
type ServerEvent = ChatMessage | TypingEvent | PresenceEvent | { type: "error"; error: string };

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 500;

/**
 * Owns one WebSocket connection to a channel. Reconnects with exponential
 * backoff on any drop, and queues messages sent while offline, replaying
 * them in order once the connection is back — so a wifi blip never
 * silently eats what the user typed.
 */
export function useChatSocket(wsUrl: string, channelId: string, wsToken: string | null) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const attemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushQueue = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (queueRef.current.length > 0) {
      socket.send(queueRef.current.shift()!);
    }
  }, []);

  const connect = useCallback(() => {
    if (!wsToken) return;
    const socket = new WebSocket(`${wsUrl}/ws/${channelId}?token=${wsToken}`);
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      setConnected(true);
      flushQueue();
    };

    socket.onmessage = (evt) => {
      const data: ServerEvent = JSON.parse(evt.data);
      if (data.type === "message") {
        setMessages((prev) => {
          // Reconcile: if this is the server's ack of an optimistic
          // message we already rendered, replace it instead of duplicating.
          if (data.clientId && prev.some((m) => m.clientId === data.clientId)) {
            return prev.map((m) => (m.clientId === data.clientId ? data : m));
          }
          return [...prev, data];
        });
      } else if (data.type === "typing") {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (data.isTyping) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      }
    };

    socket.onclose = () => {
      setConnected(false);
      socketRef.current = null;
      if (!shouldReconnectRef.current) return;

      // Exponential backoff with a ceiling, so a prolonged outage doesn't
      // hammer the server with reconnect attempts once per second forever.
      const attempt = attemptRef.current++;
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => socket.close();
  }, [wsUrl, channelId, wsToken, flushQueue]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const sendRaw = useCallback(
    (payload: object) => {
      const json = JSON.stringify(payload);
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(json);
      } else {
        // Offline: queue it. Replayed in order once the socket reopens.
        queueRef.current.push(json);
      }
    },
    []
  );

  const sendMessage = useCallback(
    (body: string, optimistic?: ChatMessage) => {
      if (optimistic) setMessages((prev) => [...prev, optimistic]);
      sendRaw({ type: "message", channelId, body, clientId: optimistic?.clientId });
    },
    [channelId, sendRaw]
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      sendRaw({ type: isTyping ? "typing:start" : "typing:stop", channelId });
    },
    [channelId, sendRaw]
  );

  return { connected, messages, setMessages, typingUsers, sendMessage, setTyping, queuedCount: () => queueRef.current.length };
}
