import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export interface UserProfile {
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
}

/**
 * Read the user's profile from the DB rather than the JWT session.
 *
 * The session is a JWT, so a name/photo edit wouldn't show up until the token
 * was reissued. Reading the row keeps the displayed identity correct the moment
 * it's saved (the (os) layout already queries the DB for preferences).
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
