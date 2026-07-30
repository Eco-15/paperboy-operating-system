// ── Ontology Tool Definitions for the Claude agent ───────────────────────────
// Generates Claude tool_use definitions from the ontology registry, SCOPED TO THE
// CALLER'S ROLE: the objectType/action enums only contain what this session may
// actually read/run. The executor re-checks (defense in depth), but restricting
// the schema means the model never sees — or tries — data it isn't allowed.

import { registry } from "../registry";
import { actionTypes } from "../actions";
import { functions } from "../functions";
import { canRead, canAct, type OntologySession } from "../auth";

export function buildOntologyToolDefs(session: OntologySession | null) {
  const readableTypes = Object.values(registry.objectTypes)
    .filter((t) => canRead(t, session))
    .map((t) => t.apiName);

  // Public form-intake actions are never agent-callable.
  const agentActions = Object.values(actionTypes).filter(
    (a) => a.requiredRole !== "public" && canAct(a, session),
  );

  const isStaffSession =
    session?.user?.role === "admin" || session?.user?.role === "internal";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [];

  if (readableTypes.length > 0) {
    // Spell out each type's real property names. Without this the model has to
    // guess them, and a guessed key used to be silently dropped — turning a failed
    // search into an unfiltered list the model then summarised as if it had
    // searched. Unknown keys now hard-error, and this is how it learns the valid ones.
    const typeCatalog = Object.values(registry.objectTypes)
      .filter((t) => canRead(t, session))
      .map((t) => {
        const props = Object.entries(t.properties)
          .filter(([, p]) => p.visible !== false)
          .map(([k]) => k)
          .join(", ");
        const note = t.agentNote ? `\n    NOTE: ${t.agentNote}` : "";
        return `- ${t.apiName} — properties: ${props}${note}`;
      })
      .join("\n");

    tools.push({
      name: "query_objects",
      description:
        `Search and filter objects in the Paperboy ontology.\n\n${typeCatalog}\n\n` +
        `Use 'search' for free-text (it matches across all text properties at once) and 'filters' ` +
        `to constrain a specific property. String/text filters are partial and case-insensitive. ` +
        `Passing a property name that doesn't exist is an error, not an empty result.`,
      input_schema: {
        type: "object" as const,
        properties: {
          objectType: {
            type: "string" as const,
            enum: readableTypes,
            description: "The object type to query",
          },
          search: {
            type: "string" as const,
            description:
              "Free-text. Matches, case-insensitively, against every text property of the type. Prefer this when you don't know which field holds the term.",
          },
          filters: {
            type: "object" as const,
            description:
              "Exact property filters, keyed by the property names listed above. String/text properties use partial match.",
            additionalProperties: { type: "string" as const },
          },
          sort: {
            type: "string" as const,
            description:
              "Property to sort by; prefix with - for descending (e.g. '-date'). Must be a real property of the type. Omit for a sensible default.",
          },
          limit: {
            type: "number" as const,
            description: "Max results to return (default 25, max 500)",
          },
          offset: {
            type: "number" as const,
            description: "Rows to skip, for paging through large result sets",
          },
        },
        required: ["objectType"],
      },
    });

    tools.push({
      name: "get_object",
      description: "Get a single object by its ID, with full properties.",
      input_schema: {
        type: "object" as const,
        properties: {
          objectType: {
            type: "string" as const,
            enum: readableTypes,
            description: "The object type",
          },
          id: {
            type: "string" as const,
            description: "The object's primary key (ID)",
          },
        },
        required: ["objectType", "id"],
      },
    });

    tools.push({
      name: "distinct_values",
      description:
        "List the values a property ACTUALLY holds, with counts. Use this before filtering on a " +
        "category/stage/type you aren't certain about — guessing a value that doesn't exist returns " +
        "zero rows and looks identical to 'there are none'.",
      input_schema: {
        type: "object" as const,
        properties: {
          objectType: {
            type: "string" as const,
            enum: readableTypes,
            description: "The object type",
          },
          property: {
            type: "string" as const,
            description: "The property whose real values you want to see (e.g. 'stage', 'category')",
          },
        },
        required: ["objectType", "property"],
      },
    });
  }

  if (agentActions.length > 0) {
    const actionDescriptions = agentActions.map((a) => {
      const paramList = Object.entries(a.parameters)
        .map(([k, v]) => `${k}${v.required ? " (required)" : ""}: ${v.label}`)
        .join(", ");
      return `- ${a.apiName}: ${a.description}. Params: {${paramList}}`;
    });

    tools.push({
      name: "execute_action",
      description: `Execute a governed action in the Paperboy system. Actions you can run:\n${actionDescriptions.join("\n")}`,
      input_schema: {
        type: "object" as const,
        properties: {
          action: {
            type: "string" as const,
            enum: agentActions.map((a) => a.apiName),
            description: "The action to execute",
          },
          params: {
            type: "object" as const,
            description: "Action parameters (see descriptions above)",
            additionalProperties: true,
          },
        },
        required: ["action", "params"],
      },
    });
  }

  // Firm-wide aggregations — staff only.
  if (isStaffSession) {
    const functionNames = Object.keys(functions);
    const functionDescs = Object.values(functions)
      .map((f) => `- ${f.name}: ${f.description}`)
      .join("\n");

    tools.push({
      name: "ontology_stats",
      description: `Get computed statistics from the Paperboy system.\n${functionDescs}`,
      input_schema: {
        type: "object" as const,
        properties: {
          function: {
            type: "string" as const,
            enum: functionNames,
            description: "Which stat function to run",
          },
        },
        required: ["function"],
      },
    });
  }

  return tools;
}
