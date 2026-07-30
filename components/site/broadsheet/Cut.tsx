/* eslint-disable @next/next/no-img-element */
import type { Story } from "@/lib/site-content/schema";

export default function Cut({ story }: { story: Story }) {
  if (!story.cut) return null;
  return (
    <figure className="fp-cut">
      <div className="fp-cut-img">
        <img src={story.cut.src} alt={story.cut.alt ?? story.cut.caption} />
      </div>
      <figcaption className="fp-cut-cap">{story.cut.caption}</figcaption>
    </figure>
  );
}
