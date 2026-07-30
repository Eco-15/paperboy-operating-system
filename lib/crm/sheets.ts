// The brand-application sheets — Kyle's fund deal flow, one or more per season.
// Shared by the inspector and the importer so the file IDs live in exactly one place.
//
// "Move to Airtable" (1L0F2zk…) and "Updates 1.23.26" (1vhweXJ…) are deliberately
// absent: both are already in brand_app (see scripts/import-deal-priorities.ts).

export interface SheetSpec {
  /** Short key for CLI filtering (--only szn4). */
  key: string;
  label: string;
  fileId: string;
  /** Written to brand_app.source so the CRM shows which season a deal came from. */
  source: string;
  /**
   * Header names as they appear in the sheet, mapped to normalized fields.
   * Verified against the real CSV by scripts/inspect-brand-app-sheets.ts —
   * the Drive index truncates headers, so never trust it alone.
   */
  columns: ColumnMap;
  /** Rows to skip before the header row. 0 = header is row 1. */
  headerOffset?: number;
}

/**
 * Header names per field. Order matters: the first name present in the sheet wins,
 * EXCEPT for dateSubmitted, where every listed column is coalesced left-to-right —
 * several sheets carry two date columns filled complementarily (szn2 has 125 rows
 * dated in one column and the other 29 in a second; szn4 splits 249/211).
 */
export interface ColumnMap {
  company?: string[];
  contactName?: string[];
  contactEmail?: string[];
  website?: string[];
  message?: string[];
  priority?: string[];
  stage?: string[];
  category?: string[];
  subcategory?: string[];
  dateSubmitted?: string[];
  /** Extra columns folded into the message as a structured header. */
  extras?: string[];
}

// Ordered oldest → newest. The importer walks them in this order so later
// seasons fill blanks the earlier ones left, and the newest sheet is the last
// word on anything still unset.
export const SHEETS: SheetSpec[] = [
  {
    key: "szn1",
    label: "paperboy ventures szn 1",
    fileId: "1utusY4XoeovcyYGw4c8-D8rNHbYbK-a7XSGtZ20QnwA",
    source: "Brand apps szn1 (2024)",
    columns: {
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      dateSubmitted: ["Submitted On"],
    },
  },
  {
    key: "szn1-list",
    label: "paperboy ventures -- brand app list -- Jan 11",
    fileId: "1-blnfUQQLYPOfuJCBJkLECFC5BjsbuYLXUZZpg866Eo",
    source: "Brand apps szn1 list (Jan 2024)",
    columns: {
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      message: ["Message"],
      dateSubmitted: ["Submitted On"],
      extras: ["Notes", "ABC"],
    },
  },
  {
    // A full diligence questionnaire, not a short application form: raise size,
    // vehicle, valuation, revenue, margin and burn all live here and exist nowhere
    // else in the CRM. They go into the message rather than being dropped.
    key: "szn1-form",
    label: "paperboy ventures Szn 1 (Responses)",
    fileId: "1LfozxCMShICtaJXFskilv9ce7fTW6DSnpV9eYk1ArYk",
    source: "Brand apps szn1 form (2024)",
    columns: {
      contactName: ["Name"],
      contactEmail: ["E-mail", "E-mail ", "Email"],
      website: ["Link to website:"],
      dateSubmitted: ["Timestamp"],
      message: ["Elevator pitch: what does your company do? \n\nOne paragraph max."],
      extras: [
        "Role / Title",
        "Cell Phone #",
        "What are the 3 biggest pieces of traction your brand currently has? \n\nSales, product, marketing, distribution, consumer feedback, etc.",
        "How much $ are you raising in this round?",
        "What's the vehicle for investment? \n\nex. SAFE note, convertible note, crowdfunding page, etc",
        "What's the valuation / cap?",
        "Any additional details related to the raise? Deadline?",
        "2023 -- Actual net revenue?",
        "2024 -- Projected net revenue?",
        "Unit gross margin % (estimated)",
        "Current $ burn rate \n\n(monthly avg, past 6 months",
        "Upload your most recent pitchdeck or sell-sheet:",
      ],
    },
  },
  {
    key: "2024",
    label: "Brand Applications -- Paperboy Ventures 2024",
    fileId: "1yeac40iLADhwiAVYAzeOpsq4V0LJpgdP2513i6tJKB8",
    source: "Brand apps 2024",
    columns: {
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      message: ["Message"],
      dateSubmitted: ["Submitted On"],
    },
  },
  {
    key: "szn2",
    label: "Brand Applications - szn 2 - paperboy ventures",
    fileId: "1CwQvMDQ0mEm89SSur2mEvGuIcPuH9dgrU7UwvrkLarI",
    source: "Brand apps szn2 (2025)",
    columns: {
      company: ["Company Name"],
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      message: ["Message"],
      // "equi" is a mangled header over the real timestamp column (125 rows);
      // "submitted on" holds the other 29. Coalesced.
      dateSubmitted: ["equi", "submitted on"],
    },
  },
  {
    key: "szn3",
    label: "pbv_brandapps_szn3_2025",
    fileId: "1bNL9ntMMJaKcisxoU7Faae-CKwFQS7jpMaempTc3CBo",
    source: "Brand apps szn3 (2025)",
    columns: {
      company: ["Company Name"],
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      message: ["Message"],
      dateSubmitted: ["Submitted On"],
    },
  },
  {
    key: "szn4",
    label: "paperboyventures_DEALS_brandapps_szn4",
    fileId: "1G-cBFNaeK1flvKicfJZNWWQ1wlrijWkiN-u2a1O9Bk4",
    source: "Brand apps szn4 (2026)",
    columns: {
      company: ["Company Name"],
      contactName: ["Name"],
      contactEmail: ["Email"],
      website: ["Website"],
      message: ["Message"],
      priority: ["Priority (1-5)", "Priority"],
      category: ["Category"],
      subcategory: ["Subcategory"],
      // "s" is a mangled header over the real timestamp column (249 rows);
      // "submitted on" holds another 211. Coalesced.
      dateSubmitted: ["s", "submitted on"],
      extras: [
        "Packagin Design Post?",
        "Product Concept Post?",
        "Founder Interview Post - 90 seconds with the founder",
        "linkedin profile",
      ],
    },
  },
];

export function sheetByKey(key: string): SheetSpec | undefined {
  return SHEETS.find((s) => s.key === key);
}
