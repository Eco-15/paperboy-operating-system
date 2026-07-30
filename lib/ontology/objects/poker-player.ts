import type { ObjectTypeDef } from "../types";

export const PokerPlayer: ObjectTypeDef<"PokerPlayer"> = {
  apiName: "PokerPlayer",
  pluralLabel: "Poker Players",
  backingTables: ["poker_player"],
  primaryKey: "id",
  titleKey: "name",
  interfaces: [],
  readRole: "any",
  writeRole: "internal",
  properties: {
    id:           { type: "string",  label: "ID",          nullable: false },
    name:         { type: "string",  label: "Name",        nullable: false, isTitle: true },
    company:      { type: "string",  label: "Company",     nullable: false },
    baseVotes:    { type: "number",  label: "Base Votes",  nullable: false },
    isCustom:     { type: "boolean", label: "Custom",      nullable: false },
    isEliminated: { type: "boolean", label: "Eliminated",  nullable: false },
    totalVotes:   { type: "number",  label: "Total Votes", nullable: false, computed: true },
    pct:          { type: "number",  label: "Vote %",      nullable: false, computed: true },
    createdAt:    { type: "datetime", label: "Created",    nullable: false },
  },
};
