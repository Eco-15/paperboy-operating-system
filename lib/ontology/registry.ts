import type { OntologyRegistry } from "./types";
import * as objectTypes from "./objects";
import { interfaces } from "./interfaces";
import { linkTypes } from "./links";
import { actionTypes } from "./actions";

/** The Paperboy OS Ontology — a frozen, singleton registry of all types. */
export const registry: OntologyRegistry = Object.freeze({
  objectTypes: Object.freeze(
    Object.fromEntries(
      Object.values(objectTypes).map((t) => [t.apiName, t]),
    ),
  ),
  linkTypes: Object.freeze(linkTypes),
  interfaces: Object.freeze(interfaces),
  actionTypes: Object.freeze(actionTypes),
});
