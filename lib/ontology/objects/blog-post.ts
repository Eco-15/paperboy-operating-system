import type { ObjectTypeDef } from "../types";

export const BlogPost: ObjectTypeDef<"BlogPost"> = {
  apiName: "BlogPost",
  pluralLabel: "Blog Posts",
  backingTables: ["blog_post"],
  primaryKey: "id",
  titleKey: "title",
  interfaces: ["Searchable"],
  readRole: "any",
  writeRole: "internal",
  properties: {
    id:          { type: "string",   label: "ID",       nullable: false },
    authorId:    { type: "string",   label: "Author",   nullable: true, visible: false },
    title:       { type: "string",   label: "Title",    nullable: false, isTitle: true },
    category:    { type: "string",   label: "Category", nullable: false },
    displayDate: { type: "string",   label: "Date",     nullable: true },
    imageUrl:    { type: "url",      label: "Image",    nullable: true },
    body:        { type: "text",     label: "Body",     nullable: false },
    status:      { type: "enum",     label: "Status",   nullable: false, enumValues: ["published", "draft"] },
    createdAt:   { type: "datetime", label: "Created",  nullable: false },
    updatedAt:   { type: "datetime", label: "Updated",  nullable: false },
  },
};
