import type { ObjectTypeDef } from "../types";

export const CalendarEvent: ObjectTypeDef<"CalendarEvent"> = {
  apiName: "CalendarEvent",
  pluralLabel: "Calendar Events",
  backingTables: ["calendar_event"],
  primaryKey: "id",
  titleKey: "title",
  interfaces: [],
  readRole: "internal",
  writeRole: "internal",
  defaultSort: "-start",
  agentNote:
    "PARTIAL CACHE — synced for a window around today only. For events outside it (especially anything " +
    "in the past), use the search_calendar tool, which queries the user's live calendar over any date range.",
  properties: {
    id:              { type: "string",   label: "ID",          nullable: false },
    calendarEventId: { type: "string",   label: "Google ID",   nullable: false, visible: false },
    userId:          { type: "string",   label: "Owner",       nullable: false, visible: false },
    title:           { type: "string",   label: "Title",       nullable: true, isTitle: true },
    description:     { type: "text",     label: "Description", nullable: true },
    start:           { type: "datetime", label: "Start",       nullable: true },
    end:             { type: "datetime", label: "End",         nullable: true },
    location:        { type: "string",   label: "Location",    nullable: true },
    attendees:       { type: "json",     label: "Attendees",   nullable: true },
    status:          { type: "enum",     label: "Status",      nullable: true, enumValues: ["confirmed", "tentative", "cancelled"] },
    htmlLink:        { type: "url",      label: "Link",        nullable: true },
    syncedAt:        { type: "datetime", label: "Synced At",   nullable: false, visible: false },
  },
};
