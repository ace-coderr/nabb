import { explorerTxUrl } from "@nabb/config";
import { Link } from "react-router";
import { useAccount } from "wagmi";
import type { ActivityItem } from "../activity";
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

export function ActivityList({
  items,
  onNavigate,
  emptyText,
}: {
  items: ActivityItem[];
  onNavigate?: () => void;
  emptyText: string;
}) {
  const { address } = useAccount();
  const now = useNow(1_000);

  if (items.length === 0) return <p className="activity-empty muted">{emptyText}</p>;

  return (
    <ol className="activity-list">
      {items.map((item) => {
        const mine = address !== undefined && item.claimer?.toLowerCase() === address.toLowerCase();
        return (
          <li key={item.id} className="activity-row">
            <Link to={`/drop/${item.dropId}`} className="activity-drop mono" onClick={onNavigate}>
              #{item.dropId.toString()}
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
