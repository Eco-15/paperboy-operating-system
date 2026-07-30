import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalUser } from "@/lib/auth/guards";
import { getPublishedUpdate } from "@/lib/portal/data";
import { fmtDate } from "@/lib/portal/format";

export default async function PortalUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePortalUser();
  const { id } = await params;
  const update = await getPublishedUpdate(id);
  if (!update) notFound();

  return (
    <article className="lp-article">
      <Link className="lp-see-all" href="/portal/updates">
        ← All updates
      </Link>
      <h1 className="lp-title" style={{ marginTop: 14 }}>
        {update.title}
      </h1>
      <div className="lp-article-date">{fmtDate(update.publishedAt)}</div>
      <div className="lp-article-body">{update.body}</div>
    </article>
  );
}
