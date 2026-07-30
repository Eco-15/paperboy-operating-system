import type { ObjectTypeDef } from "../types";

export const Investor: ObjectTypeDef<"Investor"> = {
  apiName: "Investor",
  pluralLabel: "Investors",
  backingTables: ["investor"],
  primaryKey: "id",
  titleKey: "groupName",
  interfaces: ["Searchable", "Locatable"],
  readRole: "any",
  writeRole: "internal",
  properties: {
    id:        { type: "number",  label: "ID",          nullable: false },
    type:      { type: "enum",    label: "Type",        nullable: false, enumValues: ["Angel Group", "VC", "Family Office"] },
    groupName: { type: "string",  label: "Group Name",  nullable: false, isTitle: true },
    city:      { type: "string",  label: "City",        nullable: true },
    state:     { type: "string",  label: "State",       nullable: true },
    website:   { type: "url",     label: "Website",     nullable: true },
    linkedin:  { type: "url",     label: "LinkedIn",    nullable: true },
    summary:   { type: "text",    label: "Summary",     nullable: true },
    lat:       { type: "number",  label: "Latitude",    nullable: true, visible: false },
    lng:       { type: "number",  label: "Longitude",   nullable: true, visible: false },
  },
};
