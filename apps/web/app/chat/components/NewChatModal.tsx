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
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const handleSelectUser = async (targetUserId: string) => {
    try {
      const channel = await createDirectChannel(targetUserId);
      onClose();
      router.push(`/chat/${channel.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to start chat");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden text-black">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Start a new chat</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-2 max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="text-center p-4 text-gray-500">Loading users…</p>
          ) : error ? (
            <p className="text-center p-4 text-red-500">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-center p-4 text-gray-500">
              No other users found. Invite a friend!
            </p>
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    onClick={() => handleSelectUser(user.id)}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg">
                      {user.username[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{user.username}</span>
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
