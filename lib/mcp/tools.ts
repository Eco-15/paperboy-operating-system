import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "@/lib/ontology/registry";
import { queryObjects, getObjectById } from "@/lib/ontology/query";
import { functions } from "@/lib/ontology/functions";
import { actionTypes } from "@/lib/ontology/actions";
import { executeAction } from "@/lib/ontology/actions/execute";
import "@/lib/ontology/actions/register"; // side-effect: wire action handlers
import { ontologySummary } from "@/lib/ontology/agent/prompt";
import { retrieve, diagnoseEmptyResult } from "@/lib/rag/retrieval";
import { resolveUserPrincipals } from "@/lib/rag/groups";
import { sessionFromAuthInfo, canRead, canAct, type McpSession } from "./auth";

type Extra = { authInfo?: import("@modelcontextprotocol/sdk/server/auth/types.js").AuthInfo };

const text = (obj: unknown) => ({
  content: [{ type: "text" as const, text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
});
const fail = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true as const,
});

const requireSession = (extra: Extra): McpSession | null => sessionFromAuthInfo(extra.authInfo);

// Public form-intake actions — not meaningful (and needlessly risky) from a chat.
const ACTION_DENYLIST = new Set(["SubmitInquiry", "AddSubscriber"]);

// A small, stable tool surface over the WHOLE ontology. Every handler runs under
// the signed-in user's session — owner-scoping (Gmail/Calendar/Chat) fails closed
// in the engine, and readRole/requiredRole gating is enforced here.
export function registerTools(server: McpServer) {
  server.tool(
    "list_object_types",
    "List every Paperboy ontology object type with its properties, relationships, computed functions, and available actions. Call this FIRST to learn the schema before searching or acting.",
    async (extra: Extra) => {
      if (!requireSession(extra)) return fail("Not authenticated.");
      return text(ontologySummary());
    },
  );

  server.tool(
    "search_objects",
    "Search or list objects of an ontology type. Use `search` for free text across all text properties; `filters` for per-property matches (string values, e.g. {stage:'New'}). `sort` like 'date' or '-date' (leading '-' = descending). Returns objects + total count. An unknown property name is an error, not an empty result.",
    {
      objectType: z.string(),
      search: z.string().optional(),
      filters: z.record(z.string()).optional(),
      sort: z.string().optional(),
      limit: z.number().int().positive().max(500).optional(),
      offset: z.number().int().min(0).optional(),
      include: z.array(z.string()).optional(),
    },
    async (args, extra: Extra) => {
      const session = requireSession(extra);
      if (!session) return fail("Not authenticated.");
      const typeDef = registry.objectTypes[args.objectType];
      if (!typeDef) return fail(`Unknown object type: ${args.objectType}`);
      if (!canRead(typeDef, session)) return fail(`Not permitted to read ${args.objectType}.`);
      try {
        const result = await queryObjects(typeDef, {
          filters: args.filters ?? {},
          search: args.search ?? null,
          sort: args.sort ?? null,
          limit: Math.min(args.limit ?? 50, 500),
          offset: args.offset ?? 0,
          include: args.include ?? [],
          session,
        });
        return text(result);
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  server.tool(
    "get_object",
    "Fetch one ontology object by type + id. Owner-scoped types (your Gmail/Calendar/Chats) only ever return your own rows.",
    {
      objectType: z.string(),
      id: z.string(),
      include: z.array(z.string()).optional(),
    },
    async (args, extra: Extra) => {
      const session = requireSession(extra);
      if (!session) return fail("Not authenticated.");
      const typeDef = registry.objectTypes[args.objectType];
      if (!typeDef) return fail(`Unknown object type: ${args.objectType}`);
      if (!canRead(typeDef, session)) return fail(`Not permitted to read ${args.objectType}.`);
      const obj = await getObjectById(typeDef, args.id, { session });
      if (!obj) return fail("Not found (or not yours).");
      return text(obj);
    },
  );

  server.tool(
    "run_function",
    `Run a computed ontology function. Available: ${Object.keys(functions).join(", ")}.`,
    { name: z.string() },
    async (args, extra: Extra) => {
      if (!requireSession(extra)) return fail("Not authenticated.");
      const fn = functions[args.name];
      if (!fn) return fail(`Unknown function: ${args.name}`);
      return text(await fn.compute());
    },
  );

  server.tool(
    "search_knowledge",
    "Semantic + keyword search over Paperboy's Google Drive knowledge base, permission-filtered to files you can open. Returns the most relevant passages with source links.",
    { query: z.string(), k: z.number().int().positive().max(20).optional() },
    async (args, extra: Extra) => {
      const session = requireSession(extra);
      if (!session) return fail("Not authenticated.");
      // Use the SAME principal resolver as the in-app chat. Hand-building the list
      // from ALLOWED_STAFF_DOMAIN gave MCP a different principal vocabulary to the
      // one the index was built with (it omits Google-group membership), so the two
      // hosts could disagree about which files a user can see.
      const principals = await resolveUserPrincipals(session.user.email ?? "");
      try {
        const chunks = await retrieve(args.query, {
          principals,
          isAdmin: session.user.role === "admin",
          k: args.k ?? 8,
        });
        if (!chunks.length) {
          return text(
            await diagnoseEmptyResult({
              principals,
              isAdmin: session.user.role === "admin",
            }),
          );
        }
        return text(chunks);
      } catch (err) {
        return fail(`Drive search failed (this is an error, not an empty result): ${(err as Error).message}`);
      }
    },
  );

  server.tool(
    "execute_action",
    "Perform a write action in Paperboy (e.g. CreateDeal, UpdateDeal, CastVote, SyncGmail, SyncCalendar, SyncDrive). Runs as you, with your permissions. Use list_object_types to see each action's parameters.",
    { action: z.string(), params: z.record(z.any()).optional() },
    async (args, extra: Extra) => {
      const session = requireSession(extra);
      if (!session) return fail("Not authenticated.");
      if (ACTION_DENYLIST.has(args.action)) return fail(`Action ${args.action} is not available via the connector.`);
      const actionDef = actionTypes[args.action];
      if (!actionDef) return fail(`Unknown action: ${args.action}`);
      if (!canAct(actionDef, session)) return fail(`Not permitted to run ${args.action}.`);
      const result = await executeAction(args.action, args.params ?? {}, { session });
      return text(result);
    },
  );
}
