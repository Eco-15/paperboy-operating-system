import type { ObjectTypeDef } from "../types";

/** Contact: the inquiry viewed as a person, separate from the Deal view. */
export const Contact: ObjectTypeDef<"Contact"> = {
  apiName: "Contact",
  pluralLabel: "Contacts",
  backingTables: ["inquiry"],
  primaryKey: "id",
  titleKey: "firstName",
  interfaces: ["Contactable"],
  readRole: "internal",
  writeRole: "any",
  properties: {
    id:        { type: "string",   label: "ID",         nullable: false },
    type:      { type: "enum",     label: "Type",       nullable: false, enumValues: ["investor", "founder", "contact"] },
    firstName: { type: "string",   label: "First Name", nullable: false },
    lastName:  { type: "string",   label: "Last Name",  nullable: true },
    email:     { type: "email",    label: "Email",      nullable: false },
    company:   { type: "string",   label: "Company",    nullable: true },
    position:  { type: "string",   label: "Position",   nullable: true },
    message:   { type: "text",     label: "Message",    nullable: true },
    createdAt: { type: "datetime", label: "Created",    nullable: false },
  },
};
