import { explorerTxUrl } from "@nabb/config";
import { nabbMarket } from "@nabb/config";
import { Link } from "react-router";
import { useAccount, useReadContract } from "wagmi";
import { useActivity, type ActivityItem } from "../activity";
import { useNow } from "../hooks/useNow";
import { formatAgo, formatPrice, shortAddress } from "../lib/format";

/** One line per claim, shared by the ticker, the side column and the mobile sheet. */
export function activityText(item: ActivityItem, mine: boolean): string {
  if (item.claimer !== undefined && item.unitIndex !== undefined) {
    const who = mine ? "You" : shortAddress(item.claimer);
    const price = item.pricePaid !== undefined ? ` · ${formatPrice(item.pricePaid)}` : "";
    return `${who} nabbed unit #${(item.unitIndex + 1n).toString()}${price}`;
  }
  const n = item.count ?? 1;
  return `${n} new ${n === 1 ? "claim" : "claims"}`;
}

/** Shown while the buffer is empty: loading, or a friendly nudge toward the newest drop. */
function ActivityEmpty({ onNavigate }: { onNavigate?: () => void }) {
  const { seedStatus, retrySeed } = useActivity();
  // A one-off read; nothing here refetches on a timer.
  const { data: nextDropId } = useReadContract({
    ...nabbMarket,
    functionName: "nextDropId",
    query: { enabled: seedStatus !== "loading" },
  });

  if (seedStatus === "loading") {
    return (
      <div className="activity-empty" aria-busy="true">
        <p className="muted">Loading recent claims…</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line w-80" />
        <div className="skeleton skeleton-line w-30" />
      </div>
    );
  }

  const newest = nextDropId !== undefined && nextDropId > 1n ? nextDropId - 1n : undefined;
  return (
    <div className="activity-empty">
      <p className="muted">
        {seedStatus === "error"
          ? "Couldn't load recent claims. New ones will still appear here as they land."
          : "No claims yet. Be the first to nab one."}
      </p>
      {seedStatus === "error" && (
        <button type="button" className="btn btn-sm" onClick={retrySeed}>
          Try again
        </button>
      )}
      {newest !== undefined ? (
        <Link to={`/drop/${newest}`} className="link-quiet" onClick={onNavigate}>
          Open the newest drop (#{newest.toString()}) →
        </Link>
      ) : (
        <Link to="/create" className="link-quiet" onClick={onNavigate}>
          Create the first drop →
        </Link>
      )}
    </div>
  );
}

export function ActivityList({
  items,
  onNavigate,
}: {
  items: ActivityItem[];
  onNavigate?: () => void;
}) {
  const { address } = useAccount();
  const now = useNow(1_000);

  if (items.length === 0) return <ActivityEmpty onNavigate={onNavigate} />;

  return (
    <ol className="activity-list">
      {items.map((item) => {
        const mine = address !== undefined && item.claimer?.toLowerCase() === address.toLowerCase();
        return (
          <li key={item.id} className="activity-row">
            <Link to={`/drop/${item.dropId}`} className="activity-drop" onClick={onNavigate}>
              <span className="activity-pill mono">#{item.dropId.toString()}</span>
            </Link>
            <span className="activity-text">{activityText(item, mine)}</span>
            {item.txHash ? (
              <a
                className="activity-time muted"
                href={explorerTxUrl(item.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {formatAgo(item.timestamp, now)}
              </a>
            ) : (
              <span className="activity-time muted">{formatAgo(item.timestamp, now)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
