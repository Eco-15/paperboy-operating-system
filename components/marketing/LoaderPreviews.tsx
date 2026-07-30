/* eslint-disable @next/next/no-img-element */
import { LOGO_SRC } from "@/lib/marketing/brand";

// Two contained, looping previews of the loading-screen concepts for the brand
// kit: the newspaper ("The Front Page" unfolding) and the paperboy logo riding
// across. Pure CSS animations — they loop forever inside their frames (unlike
// the real LoadingScreen, which plays once and fades).
export default function LoaderPreviews() {
  return (
    <div className="lp-grid">
      <figure className="lp-card">
        <div className="lp-frame lp-news">
          <div className="lp-news-stage">
            <div className="lp-sheet">
              <div className="lp-folio">
                <span>Vol. I</span>
                <span>Est. 2026</span>
                <span>Free</span>
              </div>
              <div className="lp-mast">The Front Page</div>
              <div className="lp-rule" />
              <div className="lp-head">Paperboy Backs Breakout Brands</div>
              <div className="lp-cols">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className="lp-bar">
            <div className="lp-bar-fill" />
          </div>
        </div>
        <figcaption className="lp-cap">Newspaper — “The Front Page” unfolds</figcaption>
      </figure>

      <figure className="lp-card">
        <div className="lp-frame lp-bike">
          <div className="lp-road" />
          <div className="lp-rider">
            <img className="lp-bike-logo" src={LOGO_SRC} alt="" />
          </div>
          <div className="lp-bike-cap">loading the front page…</div>
          <div className="lp-bar">
            <div className="lp-bar-fill" />
          </div>
        </div>
        <figcaption className="lp-cap">Paperboy — logo rides across</figcaption>
      </figure>
    </div>
  );
}
