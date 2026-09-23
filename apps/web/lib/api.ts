const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://real-time-chat-app-azwu.onrender.com";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const token = localStorage.getItem("token");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();

    if (data?.error && typeof data.error === "string") {
      return data.error;
    }

    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  } catch {
    // Response was not JSON.
  }

  return fallback;
}

/**
 * Login
 */
export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Login failed"),
    );
  }

  return response.json() as Promise<{
    token: string;
    user: {
      id: string;
      username: string;
    };
  }>;
}

/**
 * Register
 */
export async function register(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Registration failed"),
    );
  }

  return response.json() as Promise<{
    token: string;
    user: {
      id: string;
      username: string;
    };
  }>;
}

/**
 * Get WebSocket authentication token
 */
export async function getWsToken() {
  const response = await fetch(`${API_URL}/auth/ws-token`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not get WebSocket token",
      ),
    );
  }

  const data = (await response.json()) as {
    wsToken: string;
  };

  return data.wsToken;
}

/**
 * Get all channels for the current user
 */
export async function listChannels() {
  const response = await fetch(`${API_URL}/channels`, {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not list channels",
      ),
    );
  }

  const data = (await response.json()) as {
    channels: Channel[];
  };

  return data.channels;
}

/**
 * Get users
 */
export async function getUsers() {
  const response = await fetch(`${API_URL}/users`, {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not fetch users",
      ),
    );
  }

  const data = (await response.json()) as {
    users: User[];
  };

  return data.users;
}

/**
 * Get a single channel
 */
export async function getChannel(channelId: string) {
  const response = await fetch(
    `${API_URL}/channels/${encodeURIComponent(channelId)}`,
    {
      method: "GET",
      headers: {
        ...authHeaders(),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not fetch channel",
      ),
    );
  }

  const data = (await response.json()) as {
    channel: Channel;
  };

  return data.channel;
}

/**
 * Create a direct/private channel
 */
export async function createDirectChannel(
  targetUserId: string,
) {
  const response = await fetch(`${API_URL}/channels/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      targetUserId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not create direct channel",
      ),
    );
  }

  const data = (await response.json()) as {
    channel: Channel;
  };

  return data.channel;
}

/**
 * Create a group channel
 */
export async function createGroupChannel(
  memberUsernames: string[],
  name: string,
) {
  const response = await fetch(`${API_URL}/channels/group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      memberUsernames,
      name,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not create group channel",
      ),
    );
  }

  const data = (await response.json()) as {
    channel: Channel;
  };

  return data.channel;
}

/**
 * Get message history for a channel
 */
export async function getHistory(
  channelId: string,
  cursor?: string,
) {
  const url = new URL(
    `${API_URL}/channels/${encodeURIComponent(channelId)}/messages`,
  );

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Could not load message history",
      ),
    );
  }

  return response.json() as Promise<{
    messages: Message[];
    nextCursor: string | null;
  }>;
}

/**
 * Shared types
 */
export type User = {
  id: string;
  username: string;
};

export type Channel = {
  id: string;
  name: string | null;
  is_group: boolean;
  display_name?: string;
};

export type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
