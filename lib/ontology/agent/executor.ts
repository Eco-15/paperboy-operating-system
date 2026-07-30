// ── Ontology Tool Executor ────────────────────────────────────────────────────
// Bridges between a host agent loop's tool_use calls and the ontology engine.
// SECURITY: the query engine enforces owner-scoping (fail-closed) but NOT the
// admin/internal/any readRole gate — so this executor applies canRead/canAct
// itself. Every host (the in-app chat agent, MCP, anything future) inherits it.

import { registry } from "../registry";
import { queryObjects, getObjectById } from "../query";
import { executeAction } from "../actions/execute";
import { actionTypes } from "../actions";
import { functions } from "../functions";
import { canRead, canAct } from "../auth";
import type { ActionContext } from "../types";

// Ensure handlers are registered
import "../actions/register";

const deny = (msg: string) => JSON.stringify({ error: msg });

export async function executeOntologyTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  try {
    switch (toolName) {
      case "query_objects":
        return await handleQueryObjects(input, ctx);
      case "get_object":
        return await handleGetObject(input, ctx);
      case "execute_action":
        return await handleExecuteAction(input, ctx);
      case "distinct_values":
        return await handleDistinctValues(input, ctx);
      case "ontology_stats":
        return await handleOntologyStats(input, ctx);
      default:
        return deny(`Unknown ontology tool: ${toolName}`);
    }
  } catch (e) {
    // Never throw out of a tool call — a handler exception would kill the stream.
    return deny(`Tool ${toolName} failed: ${(e as Error).message}`);
  }
}

async function handleQueryObjects(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  const objectType = input.objectType as string;
  const typeDef = registry.objectTypes[objectType];
  if (!typeDef) {
    return deny(`Unknown object type: ${objectType}`);
  }
  if (!canRead(typeDef, ctx.session)) {
    return deny(`You do not have permission to read ${objectType}.`);
  }

  const filters = (input.filters ?? {}) as Record<string, string>;
  const search = (input.search as string) ?? null;
  const sort = (input.sort as string) ?? null;
  const limit = Math.min(Number(input.limit) || 25, 500);
  const offset = Math.max(Number(input.offset) || 0, 0);

  const result = await queryObjects(typeDef, {
    filters,
    search,
    sort,
    limit,
    offset,
    include: [],
    session: ctx.session,
  });

  // A zero-row answer is a hypothesis to revise, not an answer. Left bare, the model
  // relays "I couldn't find it" after ONE narrow guess — which is exactly how it
  // missed 42 emails whose subject was "Tonight: The Invitational" when asked about
  // "the Paper Invitational". Every miss now says what to try next.
  if (result.total === 0) {
    const nextSteps: string[] = [];

    if (typeDef.agentNote) {
      nextSteps.push(
        `${typeDef.apiName} is only a PARTIAL CACHE — a miss here is meaningless. ${typeDef.agentNote}`,
      );
    }
    if (Object.keys(filters).length && !search) {
      nextSteps.push(
        `You filtered on ${Object.keys(filters).join(", ")} but did not use 'search'. ` +
          `'search' matches across ALL text properties at once — retry with it.`,
      );
    }
    if (search && /\s/.test(search.trim())) {
      nextSteps.push(
        `You searched the multi-word phrase "${search.trim()}". Stored titles rarely match how people ` +
          `say them out loud. Retry with the single most distinctive word alone.`,
      );
    }
    nextSteps.push(
      "Call search_everything to find which source actually holds this — it queries email, calendar, " +
        "Drive and every object type at once.",
    );

    return JSON.stringify({
      ...result,
      warning: "No rows matched. This does NOT mean the record doesn't exist.",
      nextSteps,
    });
  }

  return JSON.stringify(result);
}

async function handleGetObject(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  const objectType = input.objectType as string;
  const id = input.id as string;
  const typeDef = registry.objectTypes[objectType];
  if (!typeDef) {
    return deny(`Unknown object type: ${objectType}`);
  }
  if (!canRead(typeDef, ctx.session)) {
    return deny(`You do not have permission to read ${objectType}.`);
  }

  const object = await getObjectById(typeDef, id, { session: ctx.session });
  if (!object) {
    return deny("Not found (or not yours).");
  }

  return JSON.stringify({ objectType, object });
}

async function handleExecuteAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  const actionName = input.action as string;
  const params = (input.params ?? {}) as Record<string, unknown>;

  const actionDef = actionTypes[actionName];
  if (!actionDef) {
    return deny(`Unknown action: ${actionName}`);
  }
  // Gate here as well as inside executeAction (defense in depth).
  if (!canAct(actionDef, ctx.session)) {
    return deny(`You do not have permission to run ${actionName}.`);
  }

  const result = await executeAction(actionName, params, ctx);
  return JSON.stringify(result);
}

// What values does this property ACTUALLY hold? Without this the agent has to guess
// (filtering stage="Diligence" when the real value is "In Diligence" matches nothing,
// and looks exactly like "no such deals").
async function handleDistinctValues(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  const objectType = input.objectType as string;
  const property = input.property as string;
  const typeDef = registry.objectTypes[objectType];
  if (!typeDef) return deny(`Unknown object type: ${objectType}`);
  if (!canRead(typeDef, ctx.session)) {
    return deny(`You do not have permission to read ${objectType}.`);
  }
  const propDef = typeDef.properties[property];
  if (!propDef) {
    const valid = Object.entries(typeDef.properties)
      .filter(([, p]) => p.visible !== false)
      .map(([k]) => k)
      .join(", ");
    return deny(`Unknown property '${property}' on ${objectType}. Valid properties: ${valid}.`);
  }

  // Reuse the query engine so ownership scoping and readRole still apply — never
  // read the table directly here.
  const result = await queryObjects(typeDef, {
    filters: {},
    limit: 500,
    offset: 0,
    include: [],
    session: ctx.session,
  });

  const counts = new Map<string, number>();
  for (const obj of result.objects) {
    const v = obj[property];
    if (v == null || v === "") continue;
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const values = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([value, count]) => ({ value, count }));

  return JSON.stringify({
    objectType,
    property,
    sampledFrom: result.objects.length,
    totalRows: result.total,
    values,
    note: values.length
      ? "These are the values that actually exist. Filter using one of them EXACTLY."
      : `No rows have a value for '${property}'.`,
  });
}

// Computed aggregations. No per-object scoping exists for these, so they require
// an authenticated caller and are staff-only (they aggregate internal data).
async function handleOntologyStats(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<string> {
  const role = ctx.session?.user?.role;
  if (!(role === "admin" || role === "internal")) {
    return deny("You do not have permission to read firm statistics.");
  }
  const fnName = input.function as string;
  const fn = functions[fnName];
  if (!fn) {
    return deny(`Unknown function: ${fnName}`);
  }

  const result = await fn.compute();
  return JSON.stringify({ function: fnName, result });
}

/** Check if a tool name is an ontology tool */
export function isOntologyTool(name: string): boolean {
  return [
    "query_objects",
    "get_object",
    "distinct_values",
    "execute_action",
    "ontology_stats",
  ].includes(name);
}
