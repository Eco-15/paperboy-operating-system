// ── Action Dispatcher ────────────────────────────────────────────────────────
// All ontology writes funnel through here. The dispatcher validates the action
// name, checks permissions, and delegates to the specific handler.

import { isStaff } from "@/lib/auth/guards";
import { actionTypes } from "./index";
import type { ActionContext, ActionHandler, ActionResult } from "../types";

// Handler registry — each handler is lazily imported to keep the dispatcher lean.
const handlers: Record<string, ActionHandler> = {};

export function registerHandler(actionName: string, handler: ActionHandler) {
  handlers[actionName] = handler;
}

export async function executeAction(
  actionName: string,
  params: Record<string, unknown>,
  ctx: ActionContext,
): Promise<ActionResult> {
  const actionDef = actionTypes[actionName];
  if (!actionDef) {
    return { ok: false, error: `Unknown action: ${actionName}` };
  }

  // Permission check
  const role = ctx.session?.user?.role;
  if (actionDef.requiredRole === "admin" && role !== "admin") {
    return { ok: false, error: "Requires admin role" };
  }
  if (actionDef.requiredRole === "internal" && !isStaff(role)) {
    return { ok: false, error: "Requires staff access" };
  }
  if (actionDef.requiredRole === "any" && !ctx.session?.user) {
    return { ok: false, error: "Authentication required" };
  }
  // "public" actions don't require auth

  const handler = handlers[actionName];
  if (!handler) {
    return { ok: false, error: `Action handler not implemented: ${actionName}` };
  }

  return handler(params, ctx);
}
