import type { NewsStory } from "@/lib/news/store";
import StoryImage from "./StoryImage";

// One day's paper as a dense card grid: the lead story spans 2×2 with a big
// hero, the rest are compact image cards. Server-rendered; every card links
// out to the source in a new tab.
export default function EditionPaper({ stories }: { stories: NewsStory[] }) {
  if (stories.length === 0) {
    return <div className="dash-empty">This edition is empty.</div>;
  }

  return (
    <div className="news-grid">
      {stories.map((s, i) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`news-card${i === 0 ? " news-card--lead" : ""}`}
        >
          {s.imageUrl && (
            <StoryImage src={s.imageUrl} alt="" className="news-card-img" />
          )}
          <div className="news-card-body">
            <div className="news-story-meta">
              {s.category && <span className="news-tag">{s.category}</span>}
              {s.source && <span className="news-source">{s.source}</span>}
            </div>
            <h3 className="news-card-title">{s.title}</h3>
            {s.summary && <p className="news-summary">{s.summary}</p>}
          </div>
        </a>
      ))}
    </div>
  );
}
