import type { InterfaceDef } from "./types";

export const Contactable: InterfaceDef = {
  apiName: "Contactable",
  label: "Contactable",
  properties: {
    contactName:  { type: "string", label: "Contact Name",  nullable: true },
    contactEmail: { type: "email",  label: "Contact Email", nullable: true },
  },
};

export const Searchable: InterfaceDef = {
  apiName: "Searchable",
  label: "Searchable",
  properties: {
    // Convention: the titleKey property is always searchable via ilike.
    // Implementations may add body/summary for full-text.
  },
};

export const Stageable: InterfaceDef = {
  apiName: "Stageable",
  label: "Stageable",
  properties: {
    stage: { type: "enum", label: "Stage", nullable: true },
  },
};

export const Locatable: InterfaceDef = {
  apiName: "Locatable",
  label: "Locatable",
  properties: {
    city:  { type: "string", label: "City",      nullable: true },
    state: { type: "string", label: "State",     nullable: true },
    lat:   { type: "number", label: "Latitude",  nullable: true },
    lng:   { type: "number", label: "Longitude", nullable: true },
  },
};

export const interfaces: Record<string, InterfaceDef> = {
  Contactable,
  Searchable,
  Stageable,
  Locatable,
};
