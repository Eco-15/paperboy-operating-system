import type { ApplicationRecord } from "./types";

// Placeholder data so the table renders before the Airtable backend is wired.
// Replace with a live `fetch('/api/records')` (see OnePagerApp.tsx) once the
// Python pipeline service is connected.
export const sampleRecords: ApplicationRecord[] = [
  {
    id: "recSAMPLE001",
    company: "Wildgrain",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@wildgrain.com",
    website: "https://wildgrain.com",
    message: "Sourdough & pasta subscription box. Looking for a seed round.",
    linkedin: "",
    one_pager_url: "https://example.com/one-pagers/wildgrain.pdf",
  },
  {
    id: "recSAMPLE002",
    company: "Olipop",
    first_name: "Ben",
    last_name: "Goodwin",
    email: "ben@drinkolipop.com",
    website: "https://drinkolipop.com",
    message: "Functional soda with prebiotics. Series C in progress.",
    linkedin: "",
    one_pager_url: "",
  },
  {
    id: "recSAMPLE003",
    company: "Graza",
    first_name: "Andrew",
    last_name: "Benin",
    email: "andrew@graza.co",
    website: "https://graza.co",
    message: "Squeezable extra-virgin olive oil for everyday cooking.",
    linkedin: "",
    one_pager_url: "",
  },
  {
    id: "recSAMPLE004",
    company: "Fly By Jing",
    first_name: "Jing",
    last_name: "Gao",
    email: "jing@flybyjing.com",
    website: "https://flybyjing.com",
    message: "Sichuan chili crisp and pantry staples. Raising growth capital.",
    linkedin: "",
    one_pager_url: "https://example.com/one-pagers/flybyjing.pdf",
  },
];
