// Shimmer placeholder rows shown while a dashboard panel loads — keeps the
// Calendar / Inbox / News panels consistent with the KPI-row skeletons.
export default function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="dash-skel" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="dash-skel-row" key={i}>
          <div className="skel dash-skel-line dash-skel-line--title" />
          <div className="skel dash-skel-line dash-skel-line--sub" />
        </div>
      ))}
    </div>
  );
}
