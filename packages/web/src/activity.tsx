import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address, Hash } from "viem";
import type { ClaimEvent } from "./lib/flashblocks";

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

const MAX_ITEMS = 40;

interface ActivityContextValue {
  items: ActivityItem[];
  push: (incoming: ActivityItem[]) => void;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const push = useCallback((incoming: ActivityItem[]) => {
    setItems((prev) => {
      const known = new Set(prev.map((i) => i.id));
      const added = incoming.filter((i) => !known.has(i.id));
      if (added.length === 0) return prev;
      return [...added, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
    });
  }, []);

  const value = useMemo(() => ({ items, push }), [items, push]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity must be used inside <ActivityProvider>");
  return value;
}
