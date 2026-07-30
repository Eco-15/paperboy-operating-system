import { requireUser, isStaff } from "@/lib/auth/guards";
import { getLatestEdition, editionLabel } from "@/lib/news/store";
import EditionPaper from "@/components/news/EditionPaper";
import RefreshNewsButton from "@/components/news/RefreshNewsButton";

// CPG News — today's paper, pulled straight from Exa.ai (daily Cloud Scheduler
// cron; staff can re-run it from here). Older editions stay in the DB (the
// builder dedupes against them) but there's no archive UI by design.
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const user = await requireUser();
  const latest = await getLatestEdition();

  return (
    <main className="tool-main">
      <div className="tool-head">
        <div>
          <div className="tool-title">CPG News</div>
          <div className="tool-sub">
            {latest
              ? `${editionLabel(latest.edition)} edition — ${latest.stories.length} stories`
              : "The daily consumer & CPG paper"}
          </div>
        </div>
        {isStaff(user.role) && <RefreshNewsButton />}
      </div>

      <div className="news-layout">
        {latest ? (
          <EditionPaper stories={latest.stories} />
        ) : (
          <div className="dash-empty">
            No stories yet — the news loop hasn&apos;t run. It publishes a fresh
            paper every morning.
          </div>
        )}
      </div>
    </main>
  );
}
