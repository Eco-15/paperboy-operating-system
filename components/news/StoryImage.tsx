"use client";

import { useState } from "react";

// Hero/thumbnail for a news story. These are hotlinked og:images from the
// source article — some 404 or block hotlinking, so a broken load removes the
// image entirely rather than leaving a broken-image icon in the paper.
export default function StoryImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [dead, setDead] = useState(false);
  if (dead) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote, unoptimizable hosts
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setDead(true)}
    />
  );
}
