import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, Hash } from "viem";
import type { ClaimEvent } from "./lib/flashblocks";
import { loadRecentClaims } from "./lib/recentClaims";

/**
 * Shared in-memory activity buffer behind the ticker, the live side column and the mobile sheet.
 * It only collects what the app already reads — the per-drop claim feed and the drop-list refreshes
 * — so showing it anywhere adds no RPC calls of its own.
 */
export interface ActivityItem {
  id: string;
  dropId: bigint;
  /** Unix seconds. */
  timestamp: number;
  /** A single claim… */
  claimer?: Address;
  unitIndex?: bigint;
  pricePaid?: bigint;
  txHash?: Hash;
  /** …or several claims noticed at once on a drop. */
  count?: number;
}

export function activityFromClaim(c: ClaimEvent): ActivityItem {
  return {
    id: c.id,
    dropId: c.dropId,
    timestamp: c.timestamp,
    claimer: c.claimer,
    unitIndex: c.unitIndex,
    pricePaid: c.pricePaid,
    txHash: c.txHash,
  };
}

const MAX_ITEMS = 20;

export type SeedStatus = "loading" | "ready" | "error";

interface ActivityContextValue {
  items: ActivityItem[];
  push: (incoming: ActivityItem[]) => void;
  /** Whether the one-off history read that fills the buffer at startup has finished. */
  seedStatus: SeedStatus;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

/** Newest first, de-duplicated by id (earlier lists win), capped to the buffer size. */
export function mergeActivity(...lists: ActivityItem[][]): ActivityItem[] {
  const seen = new Set<string>();
  const merged: ActivityItem[] = [];
  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<ActivityItem[]>([]);

  const push = useCallback((incoming: ActivityItem[]) => {
    setLive((prev) => {
      const next = mergeActivity(prev, incoming);
      const unchanged = next.length === prev.length && next.every((item, i) => item === prev[i]);
      return unchanged ? prev : next;
    });
  }, []);

  // One read of recent claims across all drops at startup — a single query that never refetches —
  // so the ticker and live column have content before any live claim arrives.
  const seed = useQuery({
    queryKey: ["activity", "seed"],
    queryFn: () => loadRecentClaims(MAX_ITEMS),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnReconnect: false,
  });
  const seeded = useMemo(() => seed.data?.map(activityFromClaim) ?? [], [seed.data]);
  const seedStatus: SeedStatus = seed.isError ? "error" : seed.isPending ? "loading" : "ready";

  const items = useMemo(() => mergeActivity(live, seeded), [live, seeded]);
  const value = useMemo(() => ({ items, push, seedStatus }), [items, push, seedStatus]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity must be used inside <ActivityProvider>");
  return value;
}
