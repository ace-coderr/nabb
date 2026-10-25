import { useCallback, useEffect, useRef, useState } from "react";
import { watchPendingClaims, type ClaimEvent } from "../lib/flashblocks";

export interface FeedClaim extends ClaimEvent {
  /** Arrived after the page loaded (as opposed to the history backfill). */
  live: boolean;
}

export type FeedStatus = "connecting" | "live" | "error";

const MAX_ITEMS = 50;

interface FeedState {
  dropId: bigint | undefined;
  claims: FeedClaim[];
  status: FeedStatus;
}

function mergeClaims(base: FeedClaim[], fresh: ClaimEvent[], live: boolean): FeedClaim[] {
  const known = new Set(base.map((c) => c.id));
  const added = fresh.filter((c) => !known.has(c.id)).map((c) => ({ ...c, live }));
  if (added.length === 0) return base;
  return (
    [...base, ...added]
      // Unit indexes strictly increase in claim order.
      .sort((a, b) => (a.unitIndex === b.unitIndex ? 0 : a.unitIndex > b.unitIndex ? -1 : 1))
      .slice(0, MAX_ITEMS)
  );
}

/** Live `Claimed` feed for a drop, newest first, sourced from the Flashblocks RPC. */
export function useClaimFeed(
  dropId: bigint | undefined,
  onNewClaims?: (claims: ClaimEvent[]) => void,
) {
  const [state, setState] = useState<FeedState>({ dropId, claims: [], status: "connecting" });
  const onNewRef = useRef(onNewClaims);
  useEffect(() => {
    onNewRef.current = onNewClaims;
  }, [onNewClaims]);

  useEffect(() => {
    if (dropId === undefined) return;
    return watchPendingClaims({
      dropId,
      onClaims: (fresh, source) => {
        setState((prev) => {
          const base = prev.dropId === dropId ? prev.claims : [];
          return { dropId, claims: mergeClaims(base, fresh, source === "live"), status: "live" };
        });
        onNewRef.current?.(fresh);
      },
      onStatus: ({ ok }) => {
        const status: FeedStatus = ok ? "live" : "error";
        setState((prev) =>
          prev.dropId === dropId
            ? prev.status === status
              ? prev
              : { ...prev, status }
            : { dropId, claims: [], status },
        );
      },
    });
  }, [dropId]);

  /** Shows claims known from elsewhere (e.g. the wallet's own receipt) before the poll sees them. */
  const addClaims = useCallback(
    (claims: ClaimEvent[]) =>
      setState((prev) =>
        prev.dropId === dropId ? { ...prev, claims: mergeClaims(prev.claims, claims, true) } : prev,
      ),
    [dropId],
  );

  const current = state.dropId === dropId;
  return {
    claims: current ? state.claims : [],
    status: current ? state.status : ("connecting" as FeedStatus),
    addClaims,
  };
}
