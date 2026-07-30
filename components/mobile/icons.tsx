// Hand-drawn line icons for the mobile shell — 22px, 1.8 stroke, currentColor.
// Kept dependency-free on purpose (no icon lib in the repo).
import type { SVGProps } from "react";

function Svg({ children, size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function NewspaperIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M4 5h13v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
      <path d="M17 8.5h1.8a1.2 1.2 0 0 1 1.2 1.2v7.3a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M7 9h7M7 12.2h7M7 15.4h4.2" />
    </Svg>
  );
}

export function KanbanIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4" width="4.6" height="16" rx="1.3" />
      <rect x="9.9" y="4" width="4.6" height="10" rx="1.3" />
      <rect x="16.3" y="4" width="4.6" height="13" rx="1.3" />
    </Svg>
  );
}

export function PeopleIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.3 2.8-5.1 5.5-5.1s4.9 1.8 5.5 5.1" />
      <path d="M15.3 5.8a3.2 3.2 0 0 1 0 5.4" />
      <path d="M17 14.6c1.9.6 3.1 2.2 3.5 4.9" />
    </Svg>
  );
}

export function GridIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </Svg>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ExternalIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </Svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.2v4M15.5 3.2v4" />
    </Svg>
  );
}

export function DocIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" />
      <path d="M13.5 3.5v5h5" />
    </Svg>
  );
}

export function LayoutIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M9.5 9.5V20" />
    </Svg>
  );
}

export function SlidersIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M4 7h4M12 7h8M4 12h9M17 12h3M4 17h2M10 17h10" />
      <circle cx="10" cy="7" r="1.9" />
      <circle cx="15" cy="12" r="1.9" />
      <circle cx="8" cy="17" r="1.9" />
    </Svg>
  );
}

export function SignOutIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13" />
      <path d="M16 8.5 19.5 12 16 15.5" />
      <path d="M19.5 12H9.5" />
    </Svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 5.8 7.5-5.8" />
    </Svg>
  );
}

export function RefreshIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 3.8v3.5H16" />
    </Svg>
  );
}

export function SortIcon(props: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <Svg size={15} {...props}>
      <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
      <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
    </Svg>
  );
}
