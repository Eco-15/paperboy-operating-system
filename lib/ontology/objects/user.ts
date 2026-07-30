import type { ObjectTypeDef } from "../types";

export const User: ObjectTypeDef<"User"> = {
  apiName: "User",
  pluralLabel: "Users",
  backingTables: ["user"],
  primaryKey: "id",
  titleKey: "name",
  interfaces: ["Contactable"],
  readRole: "internal",
  writeRole: "admin",
  properties: {
    id:        { type: "string",   label: "ID",       nullable: false },
    name:      { type: "string",   label: "Name",     nullable: true, isTitle: true },
    email:     { type: "email",    label: "Email",    nullable: false },
    role:      { type: "enum",     label: "Role",     nullable: false, enumValues: ["admin", "internal", "client"] },
    image:     { type: "url",      label: "Avatar",   nullable: true },
    createdAt: { type: "datetime", label: "Created",  nullable: false },
  },
};
