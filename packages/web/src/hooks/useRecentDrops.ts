import { nabbMarket } from "@nabb/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Drop } from "../lib/drop";
import type { DropListItem } from "../lib/dropList";
import { fetchRecentDrops, indexerAvailable } from "../lib/indexer";

const REFRESH_MS = 5_000;

export type DropsSource = "indexer" | "chain";

export type { DropListItem };

/**
 * The newest `count` drops. Read straight from NabbMarket — ids `nextDropId - 1` down to 1, one
 * multicall of getDrop/remaining/isLive per refresh — unless an indexer is configured and healthy,
 * in which case it serves the list. Any indexer failure falls back to the chain silently.
 */
export function useRecentDrops(count: number) {
  const available = useQuery({
    queryKey: ["indexer", "available"],
    queryFn: indexerAvailable,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const indexer = useQuery({
    queryKey: ["indexer", "drops", count],
    queryFn: () => fetchRecentDrops(count),
    enabled: available.data === true,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const fromIndexer = available.data === true && !indexer.isError;
  const fromChain = available.data === false || indexer.isError;

  const next = useReadContract({
    ...nabbMarket,
    functionName: "nextDropId",
    query: { enabled: fromChain, refetchInterval: REFRESH_MS },
  });

  const ids = useMemo(() => {
    if (!fromChain || next.data === undefined) return [];
    const result: bigint[] = [];
    for (let id = next.data - 1n; id >= 1n && result.length < count; id--) result.push(id);
    return result;
  }, [fromChain, next.data, count]);

  const reads = useReadContracts({
    contracts: ids.flatMap(
      (id) =>
        [
          { ...nabbMarket, functionName: "getDrop", args: [id] },
          { ...nabbMarket, functionName: "remaining", args: [id] },
          { ...nabbMarket, functionName: "isLive", args: [id] },
        ] as const,
    ),
    query: { enabled: ids.length > 0, refetchInterval: REFRESH_MS },
  });

  const chainItems = useMemo(
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

  if (fromIndexer) {
    return {
      items: (indexer.data?.items ?? []) as DropListItem[],
      hasMore: indexer.data?.hasMore ?? false,
      isLoading: indexer.isLoading,
      error: null,
      source: "indexer" as DropsSource,
      refetch: () => void indexer.refetch(),
    };
  }
  const lowest = ids.at(-1);
  return {
    items: chainItems,
    hasMore: lowest !== undefined && lowest > 1n,
    isLoading: available.isLoading || next.isLoading || (ids.length > 0 && reads.isLoading),
    error: fromChain ? (next.error ?? reads.error) : null,
    source: "chain" as DropsSource,
    refetch: () => {
      void next.refetch();
      void reads.refetch();
    },
  };
}
