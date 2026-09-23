"use client";

export default function ChatIndexPage() {
  return (
    <div className="chat-empty">
      <div className="chat-empty-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h2>Welcome to your chats</h2>
      <p>
        Select a conversation from the sidebar, or click <strong>+ New</strong> to start a new chat.
      </p>
    </div>
  );
}
