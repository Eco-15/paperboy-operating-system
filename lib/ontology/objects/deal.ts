import type { ObjectTypeDef } from "../types";

/** Deal is a union object type backed by `brand_app` + `inquiry` tables. */
export const Deal: ObjectTypeDef<"Deal"> = {
  apiName: "Deal",
  pluralLabel: "Deals",
  backingTables: ["brand_app", "inquiry"],
  primaryKey: "id",
  titleKey: "company",
  interfaces: ["Contactable", "Stageable"],
  readRole: "internal",
  writeRole: "internal",
  properties: {
    id:           { type: "string",  label: "ID",            nullable: false },
    origin:       { type: "enum",    label: "Origin",        nullable: false, enumValues: ["app", "form"] },
    company:      { type: "string",  label: "Company",       nullable: false, isTitle: true },
    category:     { type: "string",  label: "Category",      nullable: true },
    subcategory:  { type: "string",  label: "Subcategory",   nullable: true },
    source:       { type: "string",  label: "Source",        nullable: true },
    priority:     { type: "number",  label: "Priority",      nullable: true },
    // Board stages + archive statuses — keep in sync with lib/crm/stages.ts.
    stage:        { type: "enum",    label: "Stage",         nullable: true,
                    enumValues: ["New", "Outreach", "Founder Call", "Closing", "Closed", "Passed", "Hold", "Watch"] },
    fund:         { type: "enum",    label: "Fund",          nullable: true,
                    enumValues: ["Fund I", "Fund II"] },
    archived:     { type: "boolean", label: "Archived",      nullable: false },
    contactName:  { type: "string",  label: "Contact Name",  nullable: true },
    contactEmail: { type: "email",   label: "Contact Email", nullable: true },
    message:      { type: "text",    label: "Message",       nullable: true },
    website:      { type: "url",     label: "Website",       nullable: true },
    deckLink:     { type: "url",     label: "Deck Link",     nullable: true },
    onePager:     { type: "text",    label: "AI One-Pager",  nullable: true },
    date:         { type: "string",  label: "Date",          nullable: true },
    formType:     { type: "string",  label: "Form Type",     nullable: true },
  },
};
