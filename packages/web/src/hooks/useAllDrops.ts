import { nabbMarket } from "@nabb/config";
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Drop } from "../lib/drop";
import type { DropListItem } from "../lib/dropList";

/** Upper bound on how many drops one page reads, newest first. */
export const MAX_ALL_DROPS = 500;

/**
 * Every drop (newest first, capped at MAX_ALL_DROPS), read straight from NabbMarket with the same
 * multicall batching the home page uses: `nextDropId`, then getDrop / remaining / isLive per id.
 * It reads once per visit and has no refresh interval of its own; call `refetch` to update.
 */
export function useAllDrops() {
  const next = useReadContract({ ...nabbMarket, functionName: "nextDropId" });

  const { ids, total } = useMemo(() => {
    const total = next.data === undefined ? 0 : Number(next.data - 1n);
    const list: bigint[] = [];
    if (next.data !== undefined) {
      for (let id = next.data - 1n; id >= 1n && list.length < MAX_ALL_DROPS; id--) list.push(id);
    }
    return { ids: list, total };
  }, [next.data]);

  const reads = useReadContracts({
    contracts: ids.flatMap(
      (id) =>
        [
          { ...nabbMarket, functionName: "getDrop", args: [id] },
          { ...nabbMarket, functionName: "remaining", args: [id] },
          { ...nabbMarket, functionName: "isLive", args: [id] },
        ] as const,
    ),
    query: { enabled: ids.length > 0 },
  });

  const items = useMemo(
    () =>
      ids.flatMap((id, i): DropListItem[] => {
        const [drop, remaining, isLive] = [0, 1, 2].map((k) => reads.data?.[i * 3 + k]);
        if (drop?.status !== "success") return [];
        return [
          {
            id,
            drop: drop.result as Drop,
            remaining: remaining?.status === "success" ? (remaining.result as bigint) : undefined,
            isLive: isLive?.status === "success" ? (isLive.result as boolean) : undefined,
          },
        ];
      }),
    [ids, reads.data],
  );

  return {
    items,
    total,
    truncated: total > MAX_ALL_DROPS,
    isLoading: next.isLoading || (ids.length > 0 && reads.isLoading),
    error: next.error ?? reads.error,
    refetch: async () => {
      await next.refetch();
      await reads.refetch();
    },
  };
}
