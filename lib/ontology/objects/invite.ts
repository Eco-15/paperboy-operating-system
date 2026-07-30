import type { ObjectTypeDef } from "../types";

export const Invite: ObjectTypeDef<"Invite"> = {
  apiName: "Invite",
  pluralLabel: "Invites",
  backingTables: ["invite"],
  primaryKey: "id",
  titleKey: "email",
  interfaces: [],
  readRole: "admin",
  writeRole: "admin",
  properties: {
    id:         { type: "string",   label: "ID",       nullable: false },
    email:      { type: "email",    label: "Email",    nullable: false, isTitle: true },
    role:       { type: "enum",     label: "Role",     nullable: false, enumValues: ["admin", "internal", "client"] },
    invitedBy:  { type: "string",   label: "Invited By", nullable: true, visible: false },
    expiresAt:  { type: "datetime", label: "Expires",  nullable: false },
    acceptedAt: { type: "datetime", label: "Accepted", nullable: true },
    createdAt:  { type: "datetime", label: "Created",  nullable: false },
  },
};
