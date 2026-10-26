import { Link } from "react-router";
import { useActivity } from "../activity";
import { formatAgo, shortAddress } from "../lib/format";
import { BoltIcon } from "./Icons";

/**
 * A small live readout for the hero: how many drops are open and the most recent claim. It reads
 * the shared activity buffer and the drops list the page already has, so it adds no requests.
 */
export function HeroLive({ liveCount, now }: { liveCount: number | undefined; now: number }) {
  const { items, seedStatus } = useActivity();
  const latest = items.find((item) => item.claimer !== undefined && item.unitIndex !== undefined);

  return (
    <div className="hero-live" aria-label="Live now">
      <div className="hero-live-row">
        <span className="pulse" aria-hidden="true" />
        <span className="hero-live-label">Live now</span>
        <span className="hero-live-count mono">
          {liveCount === undefined ? "–" : liveCount}
          <span className="muted"> open</span>
        </span>
      </div>
      <div className="hero-live-row hero-live-claim">
        <BoltIcon width={14} height={14} className="hero-live-bolt" />
        {latest ? (
          <Link to={`/drop/${latest.dropId}`} className="hero-live-link">
            <span className="mono">#{latest.dropId.toString()}</span> · unit #
            {(latest.unitIndex! + 1n).toString()} nabbed by {shortAddress(latest.claimer!)}{" "}
            <span className="muted">{formatAgo(latest.timestamp, now)}</span>
          </Link>
        ) : (
          <span className="muted">
            {seedStatus === "loading" ? "Loading latest claim…" : "No claims yet"}
          </span>
        )}
      </div>
    </div>
  );
}
