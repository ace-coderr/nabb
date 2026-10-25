import { explorerTxUrl } from "@nabb/config";
import { useAccount } from "wagmi";
import type { FeedClaim, FeedStatus } from "../hooks/useClaimFeed";
import { formatAgo, formatPrice, shortAddress } from "../lib/format";

const STATUS_LABEL: Record<FeedStatus, string> = {
  connecting: "Connecting…",
  live: "Live via Flashblocks",
  error: "Reconnecting…",
};

export function ClaimFeed({
  claims,
  status,
  now,
}: {
  claims: FeedClaim[];
  status: FeedStatus;
  now: number;
}) {
  const { address } = useAccount();

  return (
    <section className="card feed">
      <div className="feed-head">
        <h2>Live claims</h2>
        <span className={`feed-status feed-status-${status}`}>
          <span className="feed-dot" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {claims.length === 0 ? (
        <div className="feed-empty muted">
          {status === "connecting" ? "Loading recent claims…" : "No claims yet — be the first."}
        </div>
      ) : (
        <ol className="feed-list">
          {claims.map((claim) => {
            const mine = address?.toLowerCase() === claim.claimer.toLowerCase();
            return (
              <li key={claim.id} className={`feed-row ${claim.live ? "feed-row-live" : ""}`}>
                <span className="feed-unit mono">#{(claim.unitIndex + 1n).toString()}</span>
                <span className="feed-who">
                  {mine ? <strong>You</strong> : shortAddress(claim.claimer)} nabbed for{" "}
                  {formatPrice(claim.pricePaid)}
                </span>
                <a
                  className="feed-time muted"
                  href={explorerTxUrl(claim.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatAgo(claim.timestamp, now)}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
