import InlineText from "@/components/site/InlineText";

export default function SectionHeader({
  title,
  deck,
  byline,
}: {
  title: string;
  deck?: string;
  byline?: string;
}) {
  return (
    <>
      <h1 className="fp-headline fp-headline--xl sheet-section-title">
        {title}
      </h1>
      {deck ? (
        <p className="fp-deck">
          <InlineText value={deck} />
        </p>
      ) : null}
      {byline ? <div className="fp-byline">{byline}</div> : null}
    </>
  );
}
