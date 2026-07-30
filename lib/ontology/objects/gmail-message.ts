import type { ObjectTypeDef } from "../types";

export const GmailMessage: ObjectTypeDef<"GmailMessage"> = {
  apiName: "GmailMessage",
  pluralLabel: "Gmail Messages",
  backingTables: ["gmail_message"],
  primaryKey: "id",
  titleKey: "subject",
  interfaces: ["Searchable", "Contactable"],
  readRole: "internal",
  writeRole: "internal",
  defaultSort: "-date",
  agentNote:
    "PARTIAL CACHE — this table holds only the ~50 newest messages (plus any that search_gmail has " +
    "surfaced), and never message bodies. NEVER use it to count messages or to conclude that an email " +
    "does not exist. To find or read email, use the search_gmail tool, which searches the user's entire " +
    "live mailbox including bodies.",
  properties: {
    id:        { type: "string",   label: "ID",        nullable: false },
    gmailId:   { type: "string",   label: "Gmail ID",  nullable: false, visible: false },
    userId:    { type: "string",   label: "Owner",     nullable: false, visible: false },
    threadId:  { type: "string",   label: "Thread ID", nullable: true, visible: false },
    subject:   { type: "string",   label: "Subject",   nullable: true, isTitle: true },
    from:      { type: "string",   label: "From",      nullable: true },
    to:        { type: "json",     label: "To",        nullable: true },
    cc:        { type: "json",     label: "CC",        nullable: true, visible: false },
    snippet:   { type: "text",     label: "Snippet",   nullable: true },
    isRead:    { type: "boolean",  label: "Read",      nullable: false },
    labels:    { type: "json",     label: "Labels",    nullable: true, visible: false },
    date:      { type: "datetime", label: "Date",      nullable: true },
    syncedAt:  { type: "datetime", label: "Synced At", nullable: false, visible: false },
  },
};
