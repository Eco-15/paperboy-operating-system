// What counts as a "response" — something a real person sent us, as opposed to
// a company we typed in ourselves. Feeds the CRM's "new since you last looked"
// tray on both desktop and the phone app.
//
// CLIENT-SAFE — pure predicate over the Deal shape.
import type { Deal } from "./types";

/** brand_app.source written by the CRM's own "+ Add company" form. */
export const MANUAL_SOURCE = "Added in-app";

/**
 * Inbound = website form leads (`inquiry` rows, origin "form") plus the
 * Squarespace brand applications that reach `brand_app` through the szn sheet
 * sync. Only companies staff added by hand are excluded — those aren't
 * responses, they're prospecting.
 */
export function isInboundResponse(d: Pick<Deal, "origin" | "source">): boolean {
  if (d.origin === "form") return true;
  return d.source !== MANUAL_SOURCE;
}
