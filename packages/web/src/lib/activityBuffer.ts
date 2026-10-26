import type { Address, Hash } from "viem";
import type { ClaimEvent } from "./flashblocks";

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

/** How many activity entries the app keeps. */
export const MAX_ITEMS = 20;

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
