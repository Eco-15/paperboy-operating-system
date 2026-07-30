import type { ObjectTypeDef } from "../types";

export const Chat: ObjectTypeDef<"Chat"> = {
  apiName: "Chat",
  pluralLabel: "Chats",
  backingTables: ["chat"],
  primaryKey: "id",
  titleKey: "title",
  interfaces: [],
  readRole: "any", // ownership enforced at query time
  writeRole: "any",
  properties: {
    id:        { type: "string",   label: "ID",         nullable: false },
    userId:    { type: "string",   label: "Owner",      nullable: false, visible: false },
    title:     { type: "string",   label: "Title",      nullable: false, isTitle: true },
    lastModel: { type: "string",   label: "Last Model", nullable: true },
    createdAt: { type: "datetime", label: "Created",    nullable: false },
    updatedAt: { type: "datetime", label: "Updated",    nullable: false },
  },
};
