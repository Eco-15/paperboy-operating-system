// Shared Paperboy brand constants for the public marketing site.

// The bicycle paperboy mark used across Paperboy OS (blends on the beige bg).
// TODO (owner): self-host this in public/ if you want to drop the CDN dependency.
export const LOGO_SRC =
  "https://images.squarespace-cdn.com/content/v1/6585e7cf9929135ae34643f2/1fbba9f9-9d7b-4489-99fb-28ecf82c4667/logo_swissbackground_2.6.25.png?format=1000w";

export const SITE_NAME = "Paperboy Ventures";

// TODO (owner): replace with the real inbox for founder/LP inquiries.
export const CONTACT_EMAIL = "hello@paperboyventures.com";

export const SITE_NAV = [
  { href: "/", label: "Front Page" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/press", label: "Press" },
  { href: "/about", label: "About" },
] as const;
