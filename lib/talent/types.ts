// The single normalized shape the Talent CRM renders. The API (app/api/talent)
// maps `talent` rows into this so the table, board, and detail page all speak
// one language. Mirrors lib/crm/types.ts (Deal) for the investments CRM.
export type TalentRec = {
  id: string;
  name: string;
  role: string | null; // discipline / function
  company: string | null; // current employer
  email: string | null;
  link: string | null; // LinkedIn / portfolio
  location: string | null;
  source: string | null;
  priority: number | null;
  stage: string | null;
  notes: string | null;
  date: string | null; // ISO — when they entered the roster
  archived: boolean;
};
