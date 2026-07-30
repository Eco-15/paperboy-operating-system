import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a dev-time tool (generate / migrate / push); it always uses
// DATABASE_URL — point this at Cloud SQL via the Auth Proxy, or a local Postgres.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
