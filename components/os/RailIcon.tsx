import type { ReactNode } from "react";

// Clean line icons for the left nav rail, keyed by module title (+ "Home").
// currentColor so they inherit the rail's hover/active color. Zero deps.
const ICONS: Record<string, ReactNode> = {
  Home: (
    <>
      <path d="M4 10.8 12 4l8 6.8" />
      <path d="M6 9.6V20h12V9.6" />
    </>
  ),
  "CPG News": (
    <>
      <path d="M4 5.5h13v13a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5v-13z" />
      <path d="M17 8h2.5v10.5A1.5 1.5 0 0 1 18 20" />
      <path d="M7 9h7M7 12h7M7 15h4.5" />
    </>
  ),
  "Investment CRM": (
    <>
      <rect x="3.5" y="4" width="4.3" height="16" rx="1.1" />
      <rect x="9.9" y="4" width="4.3" height="11" rx="1.1" />
      <rect x="16.3" y="4" width="4.3" height="7.5" rx="1.1" />
    </>
  ),
  Documents: (
    <>
      <path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5v4h4" />
      <path d="M8 12.5h8M8 16h5" />
    </>
  ),
  "Site Editor": (
    <>
      <path d="M4 5h13v13a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18v-13z" />
      <path d="M7 8.5h4M7 11.5h3" />
      <path d="m13.5 15.5 6.2-6.2a1.4 1.4 0 0 1 2 2l-6.2 6.2-2.6.6.6-2.6z" />
    </>
  ),
  "Brand Library": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  "Investor Database": (
    <>
      <circle cx="9" cy="8" r="3.1" />
      <path d="M3.4 20c0-3.2 2.5-5 5.6-5s5.6 1.8 5.6 5" />
      <path d="M16.2 5.3a3.1 3.1 0 0 1 0 5.9" />
      <path d="M17.7 15c2.1.5 3.9 2.2 3.9 5" />
    </>
  ),
  "Poker Tournament": (
    <>
      <path d="M12 3.6c2.5 3.3 6.8 5 6.8 8.8a3.5 3.5 0 0 1-6 2.4c.2 1.6.7 2.7 1.6 3.7H9.6c.9-1 1.4-2.1 1.6-3.7a3.5 3.5 0 0 1-6-2.4c0-3.8 4.3-5.5 6.8-8.8z" />
    </>
  ),
  "Talent CRM": (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    </>
  ),
  Matching: (
    <>
      <path d="M9.6 14.4l4.8-4.8" />
      <path d="M8.2 11.8 6.4 13.6a3.1 3.1 0 0 0 4.4 4.4l1.8-1.8" />
      <path d="M15.8 12.2l1.8-1.8a3.1 3.1 0 0 0-4.4-4.4l-1.8 1.8" />
    </>
  ),
  "Content Studio": (
    <>
      <path d="M15.4 5.6l3 3" />
      <path d="M4 20l1-4L16.6 4.4a2 2 0 0 1 2.9 2.9L8 19l-4 1z" />
    </>
  ),
  Blog: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
      <path d="M7 9.5h6M7 12.5h6M7 15.5h4" />
      <rect x="14.6" y="9.2" width="3" height="3" rx="0.5" />
    </>
  ),
  Newsletter: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" />
      <path d="M4.2 7 12 12.6 19.8 7" />
    </>
  ),
};

export default function RailIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
