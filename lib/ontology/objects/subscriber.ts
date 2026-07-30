import type { ObjectTypeDef } from "../types";

export const Subscriber: ObjectTypeDef<"Subscriber"> = {
  apiName: "Subscriber",
  pluralLabel: "Subscribers",
  backingTables: ["subscriber"],
  primaryKey: "id",
  titleKey: "email",
  interfaces: ["Contactable"],
  readRole: "internal",
  writeRole: "any",
  properties: {
    id:        { type: "string",   label: "ID",      nullable: false },
    email:     { type: "email",    label: "Email",   nullable: false, isTitle: true },
    createdAt: { type: "datetime", label: "Created", nullable: false },
  },
};
