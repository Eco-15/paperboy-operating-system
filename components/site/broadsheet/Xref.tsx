import Link from "next/link";
import type { Story } from "@/lib/site-content/schema";

export default function Xref({ story }: { story: Story }) {
  if (!story.xref) return null;
  return story.xref.external ? (
    <a
      className="sheet-xref"
      href={story.xref.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {story.xref.label}
    </a>
  ) : (
    <Link className="sheet-xref" href={story.xref.href}>
      {story.xref.label}
    </Link>
  );
}
