export type InvestorType = "Angel Group" | "VC" | "Family Office";

export interface Investor {
  Type: InvestorType;
  "Group Name": string;
  City?: string;
  State?: string;
  Website?: string;
  // Source data once had a trailing-space "LinkedIn " key; the extracted
  // dataset is clean, but keep this optional and tolerate either.
  LinkedIn?: string;
  "LinkedIn "?: string;
  Summary?: string;
}

export interface Pin {
  lat: number;
  lng: number;
  city: string;
  state: string;
  count: number;
  names: string[];
}

export type TypeCounts = Record<string, number>;

/** Sortable columns (match the original table's data-col attributes). */
export type SortCol = "Type" | "Group Name" | "City" | "State";
