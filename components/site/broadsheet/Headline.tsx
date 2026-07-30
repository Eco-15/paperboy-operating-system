import Link from "next/link";
import type { Story } from "@/lib/site-content/schema";

export default function Headline({
  story,
  className,
}: {
  story: Story;
  className: string;
}) {
  return (
    <h2 className={className}>
      {story.external ? (
        <a href={story.href} target="_blank" rel="noopener noreferrer">
          {story.headline}
        </a>
      ) : (
        <Link href={story.href}>{story.headline}</Link>
      )}
    </h2>
  );
}
