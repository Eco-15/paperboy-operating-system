import type { ObjectTypeDef } from "../types";

export const NewsItem: ObjectTypeDef<"NewsItem"> = {
  apiName: "NewsItem",
  pluralLabel: "News Items",
  backingTables: ["news_item"],
  primaryKey: "id",
  titleKey: "title",
  interfaces: ["Searchable"],
  readRole: "any",
  writeRole: "admin",
  properties: {
    id:           { type: "string",  label: "ID",             nullable: false },
    title:        { type: "string",  label: "Title",          nullable: false, isTitle: true },
    url:          { type: "url",     label: "URL",            nullable: false },
    source:       { type: "string",  label: "Source",         nullable: true },
    summary:      { type: "text",    label: "Summary",        nullable: true },
    whyItMatters: { type: "text",    label: "Why It Matters", nullable: true },
    category:     { type: "string",  label: "Category",       nullable: true },
    rank:         { type: "number",  label: "Rank",           nullable: false },
    batchId:      { type: "string",  label: "Batch ID",       nullable: true, visible: false },
    createdAt:    { type: "datetime", label: "Created",       nullable: false },
  },
};
