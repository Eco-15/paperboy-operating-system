import { config } from "dotenv";

// Load local secrets for CLI scripts.
//
// `import "dotenv/config"` — the obvious one-liner, and what the older scripts use —
// reads `.env` only. This project keeps its secrets in `.env.local` (Next.js's
// convention, and the only env file that exists here), so that import silently leaves
// DATABASE_URL undefined and the first query dies with the very unhelpful
// "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string".
//
// dotenv never overwrites an already-set variable, so .env.local wins over .env, and
// both lose to anything genuinely exported in the shell.
config({ path: ".env.local" });
config();
