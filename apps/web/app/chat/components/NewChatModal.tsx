"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsers, createDirectChannel } from "../../../lib/api";

type User = {
  id: string;
  username: string;
};

export default function NewChatModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    getUsers()
      .then((data) => {
        setUsers(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load users");
        setIsLoading(false);
      });
  }, []);

  const handleSelectUser = async (targetUserId: string) => {
    try {
      const channel = await createDirectChannel(targetUserId);
      onClose();
      router.push(`/chat/${channel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Start a new chat"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Start a new chat</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <p className="modal-hint">Loading users…</p>
          ) : error ? (
            <p className="modal-hint error">{error}</p>
          ) : users.length === 0 ? (
            <p className="modal-hint">No other users found. Invite a friend!</p>
          ) : (
            <ul className="user-list">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="user-row"
                    onClick={() => handleSelectUser(user.id)}
                  >
                    <span className="avatar">{user.username[0]?.toUpperCase() ?? "?"}</span>
                    <span>{user.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
