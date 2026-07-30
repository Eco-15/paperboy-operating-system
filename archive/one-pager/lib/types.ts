// Shape mirrors `_normalize_record` in scripts/server.py exactly, so swapping
// the mock data source for a live `/api/records` fetch is a one-line change.
export interface ApplicationRecord {
  id: string;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  website: string;
  message: string;
  linkedin: string;
  /** Empty string = one-pager not yet generated. Non-empty = PDF URL. */
  one_pager_url: string;
}
