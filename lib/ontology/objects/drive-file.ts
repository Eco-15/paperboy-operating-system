import type { ObjectTypeDef } from "../types";

export const DriveFile: ObjectTypeDef<"DriveFile"> = {
  apiName: "DriveFile",
  pluralLabel: "Drive Files",
  backingTables: ["drive_file"],
  primaryKey: "id",
  titleKey: "name",
  interfaces: ["Searchable"],
  readRole: "internal",
  writeRole: "admin",
  defaultSort: "-modifiedTime",
  agentNote:
    "This lists file METADATA only. To search what the documents actually SAY, use the search_drive tool.",
  properties: {
    id:           { type: "string",   label: "ID",            nullable: false },
    driveFileId:  { type: "string",   label: "Drive File ID", nullable: false, visible: false },
    name:         { type: "string",   label: "Name",          nullable: false, isTitle: true },
    title:        { type: "string",   label: "Title",         nullable: true },
    mimeType:     { type: "string",   label: "MIME Type",     nullable: true },
    webLink:      { type: "url",      label: "Web Link",      nullable: true },
    modifiedTime: { type: "datetime", label: "Modified",      nullable: true },
    accessors:    { type: "json",     label: "Accessors",     nullable: true, visible: false },
    // These are the values actually written: `drive_raw` by lib/rag/ingest.ts, and
    // `brand_card` / `template` by jobs/knowledge-builder. The old enum listed
    // "knowledge_builder", which is never written anywhere, and omitted both real
    // synthetic sources — so filtering DriveFile by source silently matched nothing.
    source:       { type: "enum",     label: "Source",         nullable: true, enumValues: ["drive_raw", "brand_card", "template"] },
    lastSyncedAt: { type: "datetime", label: "Last Synced",   nullable: true },
  },
};
