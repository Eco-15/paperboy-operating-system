import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Two connection modes:
//  • Cloud Run    → connect over the Cloud SQL Unix socket (private, no public IP).
//                   Set INSTANCE_CONNECTION_NAME + DATABASE_USER/NAME/PASSWORD.
//  • Local / CLI  → standard DATABASE_URL (via the Cloud SQL Auth Proxy or local pg).
// node-postgres only opens a connection on the first query, so constructing the
// pool here is safe even before the database exists (e.g. during `next build`).
// A missing config surfaces as a connection error at query time, not at import.
function makePool(): Pool {
  const instance = process.env.INSTANCE_CONNECTION_NAME;
  if (instance) {
    return new Pool({
      host: `/cloudsql/${instance}`,
      user: process.env.DATABASE_USER ?? "paperboy_app",
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME ?? "paperboy",
      max: 5,
    });
  }
  return new Pool({ connectionString: process.env.DATABASE_URL || undefined, max: 5 });
}

// Reuse a single pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };
export const pool = globalForDb.__pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
