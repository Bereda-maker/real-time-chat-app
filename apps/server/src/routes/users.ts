// apps/server/src/routes/users.ts
import { Hono } from 'hono';
import { db } from '../db'; // your DB connection
import { users } from '../db/schema'; // your schema
import { eq, ne } from 'drizzle-orm'; // or your ORM

const usersRoute = new Hono();

// Get all users except the current user
usersRoute.get('/', async (c) => {
  const currentUserId = c.get('userId'); // Assuming you have auth middleware setting this
  
  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    // add avatar if you have it
  })
  .from(users)
  .where(ne(users.id, currentUserId));

  return c.json(allUsers);
});

export default usersRoute;
