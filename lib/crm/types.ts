// The single normalized shape the Investment CRM renders. The API (app/api/crm)
// maps both `brand_app` rows (origin "app") and `inquiry` rows (origin "form")
// into this, so the table, board, and detail page all speak one language.
export type DealOrigin = "app" | "form";

export type Deal = {
  id: string;
  origin: DealOrigin;
  company: string;
  category: string | null;
  subcategory: string | null;
  source: string | null;
  priority: number | null;
  stage: string | null;
  contactName: string | null;
  contactEmail: string | null;
  message: string | null;
  website: string | null;
  deckLink: string | null;
  onePager: string | null;
  /** Display date. `brand_app` stores this free-text, so it may not parse. */
  date: string | null;
  /**
   * The row's real `created_at`, ISO. Unlike `date` this always parses, so it's
   * what sorting falls back to and what "new since you last looked" compares.
   */
  arrivedAt: string | null;
  formType: string | null;
  fund: string | null;
  archived: boolean;
};
