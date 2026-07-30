// ── Ontology Core Type Definitions ────────────────────────────────────────────
// Inspired by Palantir's Ontology primitives, adapted for a Next.js/Drizzle app.
// These types define the *semantic schema* of the business, separate from the
// Drizzle storage schema. The ontology sits one layer above the DB.

// ── Property Types ───────────────────────────────────────────────────────────

export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "email"
  | "url"
  | "text" // long-form string (body, summary, etc.)
  | "enum"
  | "json";

export interface PropertyDef {
  type: PropertyType;
  /** Human label for the AI and UI */
  label: string;
  /** For enum properties, the allowed values */
  enumValues?: readonly string[];
  /** Nullable? Default true */
  nullable?: boolean;
  /** Is this the title key? (at most one per object type) */
  isTitle?: boolean;
  /** Should the AI agent expose this to users? (default true) */
  visible?: boolean;
  /** Computed at read time (not a DB column) */
  computed?: boolean;
}

// ── Object Type ──────────────────────────────────────────────────────────────

export interface ObjectTypeDef<TApiKey extends string = string> {
  /** Machine-readable key: "Investor", "Deal", "BlogPost", etc. */
  apiName: TApiKey;
  /** Human-readable plural for UI and AI prompts */
  pluralLabel: string;
  /** The Drizzle table(s) that back this object type. Array for union types. */
  backingTables: readonly string[];
  /** Property definitions, keyed by the API property name */
  properties: Record<string, PropertyDef>;
  /** The property that serves as the primary key */
  primaryKey: string;
  /** The property shown as the "title" in listings and links */
  titleKey: string;
  /** Interface names this object type implements */
  interfaces: readonly string[];
  /** Required role to read (default: any authenticated) */
  readRole?: "admin" | "internal" | "any";
  /** Required role to write (default: "internal") */
  writeRole?: "admin" | "internal" | "any";
  /**
   * Sort applied when the caller doesn't specify one. Prefix with `-` for
   * descending. Without this, tables lacking a `createdAt` column come back in
   * whatever order Postgres feels like.
   */
  defaultSort?: string;
  /**
   * A caveat surfaced to the AI agent (in the ontology summary and the
   * query_objects tool description). Use it where the data is not what the agent
   * would reasonably assume — e.g. a table that is only a partial cache.
   */
  agentNote?: string;
}

// ── Link Type ────────────────────────────────────────────────────────────────

export type Cardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface LinkTypeDef {
  /** Machine name: "authored_by", "has_votes", etc. */
  apiName: string;
  /** Human label for the AI */
  label: string;
  /** Source object type apiName */
  from: string;
  /** Target object type apiName */
  to: string;
  cardinality: Cardinality;
  /** The FK column on the source (or join) table */
  foreignKey?: string;
  /** Reverse navigation name */
  reverse?: string;
}

// ── Interface ────────────────────────────────────────────────────────────────

export interface InterfaceDef {
  apiName: string;
  label: string;
  /** Required properties -- implementing object types must have these */
  properties: Record<string, PropertyDef>;
}

// ── Action Type ──────────────────────────────────────────────────────────────

export interface ActionParameter {
  type: PropertyType | "objectRef";
  label: string;
  /** For objectRef, the target object type */
  objectType?: string;
  required?: boolean;
  enumValues?: readonly string[];
}

export interface ActionTypeDef {
  apiName: string;
  label: string;
  description: string;
  /** Input parameters for the action */
  parameters: Record<string, ActionParameter>;
  /** Which object types this action creates/modifies */
  modifies: readonly string[];
  /** Required role to execute */
  requiredRole: "admin" | "internal" | "any" | "public";
  /** Side effects declared for auditability */
  sideEffects?: readonly string[];
}

// ── Action Execution ─────────────────────────────────────────────────────────

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  /** Audit trail: what changed */
  edits?: Array<{
    objectType: string;
    objectId: string;
    operation: "create" | "update" | "delete";
  }>;
}

export type ActionHandler = (
  params: Record<string, unknown>,
  ctx: ActionContext,
) => Promise<ActionResult>;

export interface ActionContext {
  session: {
    user: { id: string; role?: string | null; email?: string | null };
  } | null;
}

// ── Query Options ────────────────────────────────────────────────────────────

export interface QueryOpts {
  filters: Record<string, string>;
  /**
   * Free-text: case-insensitive match across every visible text-ish property of
   * the type. Narrows the result set only — it can never widen it past the
   * ownership scope.
   */
  search?: string | null;
  sort?: string | null;
  limit: number;
  offset: number;
  include: string[];
  session: ActionContext["session"];
}

export interface QueryResult {
  objectType: string;
  objects: Record<string, unknown>[];
  total: number;
}

// ── The Registry ─────────────────────────────────────────────────────────────

export interface OntologyRegistry {
  objectTypes: Record<string, ObjectTypeDef>;
  linkTypes: Record<string, LinkTypeDef>;
  interfaces: Record<string, InterfaceDef>;
  actionTypes: Record<string, ActionTypeDef>;
}
