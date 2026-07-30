// The public CouponForm configurations, shared by the server pages and the
// Site Editor canvas (which renders them dimmed / non-interactive). Form
// fields are deliberately NOT editable content — they map to real API
// payloads (lib/site/forms.ts) — so they live here as code, not in site_page.

import type { CouponField } from "@/components/site/CouponForm";

export type CouponFormConfig = {
  title: string;
  action: string;
  extra?: Record<string, string>;
  fields: CouponField[];
  submitLabel: string;
  successLine: string;
};

export const APPLY_FORM: CouponFormConfig = {
  title: "Application — Clip & Post",
  action: "/api/apply",
  fields: [
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name" },
    {
      name: "email",
      label: "Email address",
      type: "email",
      required: true,
      placeholder: "you@brand.com",
    },
    { name: "brand", label: "Brand", required: true },
    { name: "website", label: "Website", placeholder: "https://" },
    {
      name: "raising",
      label: "Raising (round · amount · cap)",
      placeholder: "e.g. Seed · $1.5m · $12m cap",
    },
    {
      name: "interest",
      label: "Applying for",
      type: "radios",
      required: true,
      options: [
        { value: "both", label: "Content feature + direct investment" },
        { value: "feature", label: "Content feature" },
        { value: "investment", label: "Direct investment (Fund I)" },
      ],
    },
    {
      name: "pitch",
      label: "The pitch — product, traction, why now",
      type: "textarea",
      required: true,
    },
  ],
  submitLabel: "Submit application",
  successLine: "Received — the desk will write back.",
};

export const JOBS_FORMS: CouponFormConfig[] = [
  {
    title: "The Weekly Roles",
    action: "/api/subscribe",
    extra: { list: "jobs" },
    fields: [
      {
        name: "email",
        label: "Email address",
        type: "email",
        required: true,
        placeholder: "you@work.com",
      },
    ],
    submitLabel: "Subscribe",
    successLine: "Received — fresh roles arrive weekly.",
  },
  {
    title: "Join the Talent Network",
    action: "/api/subscribe",
    extra: { list: "talent" },
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      {
        name: "note",
        label: "What you do (role · focus · city)",
        placeholder: "e.g. Growth lead · beverage · NYC",
      },
    ],
    submitLabel: "Sign up",
    successLine: "Received — private role invites will find you.",
  },
  {
    title: "Hiring? Submit a Role",
    action: "/api/jobs",
    fields: [
      { name: "company", label: "Company", required: true },
      {
        name: "contactEmail",
        label: "Contact email",
        type: "email",
        required: true,
      },
      { name: "roleTitle", label: "Role title", required: true },
      { name: "link", label: "Posting link", placeholder: "https://" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    submitLabel: "Submit role",
    successLine: "Received — the desk reviews every submission.",
  },
];
