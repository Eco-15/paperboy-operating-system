import type { Metadata } from "next";
import Link from "next/link";
import Sheet from "@/components/site/Sheet";
import { PRESS_THUMBNAILS } from "@/lib/marketing/pressPosts";
import { listPressPosts, type PublicPressPost } from "@/lib/press/store";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "The Paperboy blog — DEALS interviews and stories on the consumer brands we back.",
};

// Reads published OS-authored posts from the DB per request.
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type PressCard = {
  post: PublicPressPost;
  image: string;
  variant?: "A" | "B";
};

const VARIANT_LABELS: Record<"A" | "B", string> = {
  A: "Direction A — Studio",
  B: "Direction B — Newsboy",
};

// A/B thumbnail treatments only apply to legacy posts listed in PRESS_THUMBNAILS.
function toCards(post: PublicPressPost): PressCard[] {
  const thumbs = post.kind === "legacy" ? PRESS_THUMBNAILS[post.slug] : undefined;
  if (!thumbs) return [{ post, image: post.heroImage }];
  return [
    { post, image: thumbs.a, variant: "A" },
    { post, image: thumbs.b, variant: "B" },
  ];
}

export default async function PressPage() {
  const posts = await listPressPosts();
  const cards = posts.flatMap(toCards);

  return (
    <Sheet section="The Blog" kicker="Dispatches from the Paperboy Desk">
      <h1 className="fp-headline fp-headline--xl sheet-section-title">The Blog</h1>
      <div className="fp-byline">DEALS interviews &amp; stories from the desk</div>

      <div className="sheet-press-grid">
        {cards.map(({ post, image, variant }) => (
          <Link
            key={variant ? `${post.slug}-${variant}` : post.slug}
            href={`/press/${post.slug}`}
            className="sheet-press-card"
          >
            <article className="fp-article">
              <div className="site-press-date">
                {post.tag ? `${post.tag} · ` : ""}
                {formatDate(post.dateIso)}
              </div>
              <h2 className="fp-headline">
                <span>{post.title}</span>
              </h2>
              {variant ? (
                <div className="site-press-variant">{VARIANT_LABELS[variant]}</div>
              ) : null}
              {image ? (
                <figure className="site-photo" style={{ margin: "12px 0" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={post.title} />
                </figure>
              ) : null}
              <p className="fp-deck fp-deck--sm">{post.excerpt}</p>
              <div className="fp-byline" style={{ textAlign: "left" }}>
                By {post.author}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
