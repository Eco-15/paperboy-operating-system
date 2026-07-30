// ── Ontology Summary for AI Agent System Prompt ──────────────────────────────
// Generates a compressed ontology description that gets prepended to the
// agent's system prompt, giving Claude full awareness of all object types,
// their properties, relationships, and available actions.

import { registry } from "../registry";
import { actionTypes } from "../actions";
import { functions } from "../functions";

export function ontologySummary(): string {
  const lines: string[] = [
    "## Paperboy Ontology",
    "",
    "You have access to a structured ontology of Paperboy Ventures' data.",
    "Use the ontology tools (query_objects, get_object, execute_action, ontology_stats)",
    "to search, filter, and modify data across all modules.",
    "",
    "### Object Types",
  ];

  for (const t of Object.values(registry.objectTypes)) {
    const props = Object.entries(t.properties)
      .filter(([, p]) => p.visible !== false)
      .map(([k, p]) => {
        let desc = `${k}: ${p.type}`;
        if (p.enumValues) desc += ` (${p.enumValues.join(" | ")})`;
        return desc;
      })
      .join(", ");
    lines.push(`- **${t.apiName}** (${t.pluralLabel}): {${props}}`);
    if (t.agentNote) lines.push(`  - ⚠️ ${t.agentNote}`);
  }

  // Links
  lines.push("");
  lines.push("### Relationships");
  for (const l of Object.values(registry.linkTypes)) {
    lines.push(`- ${l.from} --${l.apiName}--> ${l.to} (${l.cardinality})`);
  }

  // Actions
  lines.push("");
  lines.push("### Available Actions");
  for (const a of Object.values(actionTypes)) {
    const paramList = Object.entries(a.parameters)
      .map(([k, v]) => `${k}${v.required ? "*" : ""}: ${v.label}`)
      .join(", ");
    lines.push(`- **${a.apiName}**: ${a.description}. Params: {${paramList}}`);
  }

  // Cross-referencing guide
  lines.push("");
  lines.push("### Cross-Referencing");
  lines.push("- **Email and calendar live in Google, not here.** `search_gmail` and `search_calendar` query the user's real mailbox/calendar and are the only authoritative sources. The GmailMessage and CalendarEvent tables are small caches — never answer \"I couldn't find it\" from them alone.");
  lines.push("- To find emails from a meeting attendee: query CalendarEvent for the meeting, extract attendee emails, then `search_gmail` with `from:<email>`");
  lines.push("- To find meetings with an email sender: extract the sender email, then `search_calendar` with that name/email as the query");
  lines.push("- JSON array properties (to, cc, labels, attendees) support containment filtering — pass a single value and it checks if the array contains it");
  lines.push("- Don't know which object type holds a concept? Use `search_everything` — it queries them all at once, plus email, calendar and Drive.");
  lines.push("- Unsure what values a property really holds (stage, category, type)? Call `distinct_values` before filtering on a guess.");

  // Functions
  lines.push("");
  lines.push("### Computed Functions");
  for (const f of Object.values(functions)) {
    lines.push(`- **${f.name}**: ${f.description}`);
  }

  return lines.join("\n");
}
