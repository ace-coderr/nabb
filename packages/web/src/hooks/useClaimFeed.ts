import { useCallback, useEffect, useRef, useState } from "react";
import { watchPendingClaims, type ClaimEvent } from "../lib/flashblocks";
import { fetchDropClaims, indexerAvailable } from "../lib/indexer";

export interface FeedClaim extends ClaimEvent {
  /** Arrived after the page loaded (as opposed to history). */
  live: boolean;
}

export type FeedStatus = "connecting" | "live" | "error";

const MAX_ITEMS = 50;

interface FeedState {
  dropId: bigint | undefined;
  claims: FeedClaim[];
  status: FeedStatus;
}

const initialState = (dropId: bigint | undefined): FeedState => ({
  dropId,
  claims: [],
  status: "connecting",
});

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

/**
 * Claim feed for a drop, newest first, read from chain logs: history from sealed blocks and new
 * claims from the Flashblocks RPC the moment they are preconfirmed. A healthy indexer, when one is
 * configured, fills history faster. Every source uses `txHash:logIndex` ids, so overlaps merge.
 */
export function useClaimFeed(
  dropId: bigint | undefined,
  onNewClaims?: (claims: ClaimEvent[]) => void,
) {
  const [state, setState] = useState<FeedState>(() => initialState(dropId));
  const onNewRef = useRef(onNewClaims);
  useEffect(() => {
    onNewRef.current = onNewClaims;
  }, [onNewClaims]);

  useEffect(() => {
    if (dropId === undefined) return;
    let cancelled = false;
    const update = (fn: (prev: FeedState) => FeedState) =>
      setState((prev) => fn(prev.dropId === dropId ? prev : initialState(dropId)));

    void indexerAvailable()
      .then((ok) => (ok ? fetchDropClaims(dropId) : undefined))
      .then((claims) => {
        if (cancelled || !claims) return;
        update((prev) => ({ ...prev, claims: mergeClaims(prev.claims, claims, false) }));
        onNewRef.current?.(claims);
      })
      // The on-chain history walk covers the same ground, so an indexer failure needs no handling.
      .catch(() => undefined);

    const stop = watchPendingClaims({
      dropId,
      onClaims: (fresh, source) => {
        update((prev) => ({
          ...prev,
          claims: mergeClaims(prev.claims, fresh, source === "live"),
          status: "live",
        }));
        onNewRef.current?.(fresh);
      },
      onStatus: ({ ok }) => {
        const status: FeedStatus = ok ? "live" : "error";
        update((prev) => (prev.status === status ? prev : { ...prev, status }));
      },
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [dropId]);

  /** Shows claims known from elsewhere (e.g. the wallet's own receipt) before the poll sees them. */
  const addClaims = useCallback(
    (claims: ClaimEvent[]) =>
      setState((prev) =>
        prev.dropId === dropId ? { ...prev, claims: mergeClaims(prev.claims, claims, true) } : prev,
      ),
    [dropId],
  );

  const current = state.dropId === dropId ? state : initialState(dropId);
  return {
    claims: current.claims,
    status: current.status,
    addClaims,
  };
}
