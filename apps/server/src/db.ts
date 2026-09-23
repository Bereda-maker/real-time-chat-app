import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://chat:chat@localhost:5432/chat";

// Durable state lives here. Never store typing/presence in Postgres —
// that's ephemeral state and belongs in Redis (see README).
export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export type MessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
