import { Link } from "react-router";
import { useMetadata } from "../hooks/useMetadata";
import type { DropListItem } from "../hooks/useRecentDrops";
import { reconciledPhase } from "../lib/drop";
import { formatDuration, formatPrice } from "../lib/format";
import { DropArt, PhaseBadge, ProgressBar } from "./DropBits";

export function DropCard({ item, now }: { item: DropListItem; now: number }) {
  const { id, drop } = item;
  const { data: metadata } = useMetadata(drop.metadataURI, id);
  const phase = reconciledPhase(drop, now, item.isLive);
  const name = metadata?.name ?? `Drop #${id}`;
  const left = item.remaining ?? drop.totalUnits - drop.claimedUnits;

  let timing = "";
  if (phase === "upcoming") timing = `Opens in ${formatDuration(Number(drop.startTime) - now)}`;
  if (phase === "live") timing = `Ends in ${formatDuration(Number(drop.endTime) - now)}`;

  return (
    <Link to={`/drop/${id}`} className="card drop-card">
      <DropArt image={metadata?.image} name={name} seed={id} />
      <div className="drop-card-body">
        <div className="drop-card-top">
          <PhaseBadge phase={phase} />
          <span className="muted mono">#{id.toString()}</span>
        </div>
        <h3 className="drop-card-title">{name}</h3>
        <div className="drop-card-row">
          <span className="price">{formatPrice(drop.price)}</span>
          <span className="muted">
            {left.toString()} / {drop.totalUnits.toString()} left
          </span>
        </div>
        <ProgressBar claimed={drop.totalUnits - left} total={drop.totalUnits} />
        {timing && <div className="muted small">{timing}</div>}
      </div>
    </Link>
  );
}
