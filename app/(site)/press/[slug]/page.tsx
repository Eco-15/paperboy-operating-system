import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Sheet from "@/components/site/Sheet";
import PressMarkdown from "@/components/press/PressMarkdown";
import type { PressBlock } from "@/lib/marketing/pressPosts";
import { getPressPost } from "@/lib/press/store";

// Articles now come from two sources: the static legacy Squarespace import
// and published OS-authored posts in the DB — so this renders per request.
// (?draft=1 + staff session previews an unpublished draft.)
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ draft?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPressPost(slug, searchParams);
  if (!post) return { title: "Press" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.heroImage ? [{ url: post.heroImage }] : [],
    },
  };
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Block({ block, isFirstP }: { block: PressBlock; isFirstP: boolean }) {
  switch (block.type) {
    case "h":
      return <h2 className="site-subhead">{block.text}</h2>;
    case "quote":
      return <blockquote className="site-quote">{block.text}</blockquote>;
    case "img":
      return (
        <figure className="site-photo site-article-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt || ""} />
        </figure>
      );
    case "p": {
      const first = block.spans[0]?.text ?? "";
      return (
        <p>
          {block.spans.map((span, i) => {
            let text = span.text;
            let dropcap: React.ReactNode = null;
            if (isFirstP && i === 0 && first.length > 1) {
              dropcap = <span className="fp-dropcap">{first.charAt(0)}</span>;
              text = first.slice(1);
            }
            return span.href ? (
              <a key={i} href={span.href} target="_blank" rel="noopener noreferrer">
                {text}
              </a>
            ) : (
              <span key={i}>
                {dropcap}
                {text}
              </span>
            );
          })}
        </p>
      );
    }
  }
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const post = await getPressPost(slug, searchParams);
  if (!post) notFound();

  const blocks = post.blocks ?? [];
  const firstPIndex = blocks.findIndex((b) => b.type === "p");

  return (
    <Sheet section="The Blog">
      <div className="site-article">
        <Link className="site-back-link" href="/press">
          ← Back to the Blog
        </Link>
        <div className="fp-folio">
          <span>{post.tag ?? "Dispatch"}</span>
          <span>{formatDate(post.dateIso)}</span>
        </div>
        <article style={{ marginTop: 22 }}>
          <h1 className="fp-headline fp-headline--xl">{post.title}</h1>
          {post.excerpt ? <p className="fp-deck">{post.excerpt}</p> : null}
          <div className="fp-byline">By {post.author} · New York</div>
          {post.heroImage ? (
            <figure className="site-photo" style={{ margin: "0 0 22px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.heroImage} alt={post.title} />
            </figure>
          ) : null}
          <div className="fp-body">
            {post.kind === "legacy" ? (
              blocks.map((block, i) => (
                <Block key={i} block={block} isFirstP={i === firstPIndex} />
              ))
            ) : (
              <PressMarkdown md={post.bodyMd ?? ""} />
            )}
          </div>
          {(post.youtube || post.spotify) && (
            <div className="site-media-links">
              {post.youtube && (
                <a
                  className="site-media-link"
                  href={post.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch on YouTube →
                </a>
              )}
              {post.spotify && (
                <a
                  className="site-media-link site-media-link--ghost"
                  href={post.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Listen on Spotify →
                </a>
              )}
            </div>
          )}
          {post.sourceUrl ? (
            <p className="site-fine" style={{ marginTop: 18 }}>
              Originally published at{" "}
              <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">
                paperboyventures.com
              </a>
              .
            </p>
          ) : null}
        </article>
      </div>
    </Sheet>
  );
}
