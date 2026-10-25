import { useCallback, useEffect, useRef, useState } from "react";
import { watchPendingClaims, type ClaimEvent } from "../lib/flashblocks";
import { fetchDropClaims } from "../lib/indexer";

export interface FeedClaim extends ClaimEvent {
  /** Arrived after the page loaded (as opposed to history). */
  live: boolean;
}

export type FeedStatus = "connecting" | "live" | "error";

/** Where older claims come from: the indexer, or only the Flashblocks look-back window. */
export type FeedHistory = "loading" | "indexer" | "recent";

const MAX_ITEMS = 50;

interface FeedState {
  dropId: bigint | undefined;
  claims: FeedClaim[];
  status: FeedStatus;
  history: FeedHistory;
}

const initialState = (dropId: bigint | undefined): FeedState => ({
  dropId,
  claims: [],
  status: "connecting",
  history: "loading",
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
 * Claim feed for a drop, newest first. History comes from the indexer; new claims stream in from
 * the Flashblocks RPC the moment they are preconfirmed. Both use the same `txHash:logIndex` ids,
 * so overlapping entries merge into one.
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

    fetchDropClaims(dropId)
      .then((claims) => {
        if (cancelled) return;
        update((prev) => ({
          ...prev,
          claims: mergeClaims(prev.claims, claims, false),
          history: "indexer",
        }));
        onNewRef.current?.(claims);
      })
      .catch(() => {
        if (!cancelled) update((prev) => ({ ...prev, history: "recent" }));
      });

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
    history: current.history,
    addClaims,
  };
}
