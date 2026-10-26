import { reconciledPhase, type Drop, type DropPhase } from "./drop";

/** One drop as shown in a list: its record, plus the contract's own `remaining()` / `isLive()`. */
export interface DropListItem {
  id: bigint;
  drop: Drop;
  /** From the contract's `remaining()`; absent when served by the indexer. */
  remaining?: bigint;
  /** From the contract's `isLive()`; absent when served by the indexer. */
  isLive?: boolean;
}

export const STATUS_FILTERS = ["all", "live", "upcoming", "ended", "soldOut"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  live: "Live",
  upcoming: "Upcoming",
  ended: "Ended",
  soldOut: "Sold out",
};

export const SORT_KEYS = ["newest", "ending", "claimed"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest",
  ending: "Ending soon",
  claimed: "Most claimed",
};

export function parseFilter(raw: string | null | undefined): StatusFilter {
  return STATUS_FILTERS.find((f) => f === raw) ?? "all";
}

export function parseSort(raw: string | null | undefined): SortKey {
  return SORT_KEYS.find((s) => s === raw) ?? "newest";
}

export function claimedOf(item: DropListItem): bigint {
  const left = item.remaining ?? item.drop.totalUnits - item.drop.claimedUnits;
  return item.drop.totalUnits - left;
}

export function phaseOf(item: DropListItem, now: number): DropPhase {
  return reconciledPhase(item.drop, now, item.isLive);
}

/** The filter chip a phase belongs to: a drop the creator closed counts as ended. */
export function groupOf(phase: DropPhase): Exclude<StatusFilter, "all"> {
  return phase === "closed" ? "ended" : phase;
}

export function applyFilter(items: DropListItem[], filter: StatusFilter, now: number) {
  if (filter === "all") return items;
  return items.filter((item) => groupOf(phaseOf(item, now)) === filter);
}

export function countByStatus(items: DropListItem[], now: number): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: items.length,
    live: 0,
    upcoming: 0,
    ended: 0,
    soldOut: 0,
  };
  for (const item of items) counts[groupOf(phaseOf(item, now))]++;
  return counts;
}

const byNewest = (a: DropListItem, b: DropListItem) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0);

/** Returns a sorted copy. Ties always fall back to newest first, so the order is stable. */
export function sortItems(items: DropListItem[], sort: SortKey, now: number): DropListItem[] {
  const copy = [...items];
  switch (sort) {
    case "newest":
      return copy.sort(byNewest);
    case "claimed":
      return copy.sort((a, b) => {
        const diff = claimedOf(b) - claimedOf(a);
        return diff > 0n ? 1 : diff < 0n ? -1 : byNewest(a, b);
      });
    case "ending":
      return copy.sort((a, b) => {
        const aLive = phaseOf(a, now) === "live";
        const bLive = phaseOf(b, now) === "live";
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (aLive && bLive && a.drop.endTime !== b.drop.endTime) {
          return a.drop.endTime < b.drop.endTime ? -1 : 1;
        }
        return byNewest(a, b);
      });
  }
}

export interface HomeEntry {
  item: DropListItem;
  /** True only for drops pinned by the featured list (not for the "newest live" default). */
  featured: boolean;
}

/**
 * Order for the home grid: pinned (featured) drops first, in the configured order, then live drops
 * newest first, then everything else newest first. Every input item appears exactly once.
 */
export function orderForHome(
  items: DropListItem[],
  now: number,
  featuredIds: readonly bigint[],
): HomeEntry[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const pinned: HomeEntry[] = [];
  const used = new Set<bigint>();
  for (const id of featuredIds) {
    const item = byId.get(id);
    if (item && !used.has(id)) {
      used.add(id);
      pinned.push({ item, featured: true });
    }
  }
  const rest = items.filter((item) => !used.has(item.id)).sort(byNewest);
  const live = rest.filter((item) => phaseOf(item, now) === "live");
  const other = rest.filter((item) => phaseOf(item, now) !== "live");
  return [...pinned, ...[...live, ...other].map((item) => ({ item, featured: false }))];
}
