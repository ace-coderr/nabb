import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  activityFromClaim,
  mergeActivity,
  MAX_ITEMS,
  type ActivityItem,
} from "./lib/activityBuffer";
import { loadRecentClaims } from "./lib/recentClaims";

/**
 * Shared in-memory activity buffer behind the ticker, the live side column and the mobile sheet.
 * It only collects what the app already reads — the per-drop claim feed and the drop-list refreshes
 * — so showing it anywhere adds no RPC calls of its own.
 */
export { activityFromClaim, mergeActivity, type ActivityItem };

export type SeedStatus = "loading" | "ready" | "error";

interface ActivityContextValue {
  items: ActivityItem[];
  push: (incoming: ActivityItem[]) => void;
  /** Whether the one-off history read that fills the buffer at startup has finished. */
  seedStatus: SeedStatus;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

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
