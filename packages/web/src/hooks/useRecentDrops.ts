import { nabbMarket } from "@nabb/config";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Drop } from "../lib/drop";
import { fetchRecentDrops } from "../lib/indexer";

const PAGE_SIZE = 12;
const REFRESH_MS = 5_000;

export type DropsSource = "indexer" | "chain";

/**
 * The newest drops. Served by the indexer; if it can't be reached the list is read straight from
 * the contract instead, and switches back once the indexer answers again.
 */
export function useRecentDrops() {
  const indexer = useQuery({
    queryKey: ["indexer", "drops", PAGE_SIZE],
    queryFn: () => fetchRecentDrops(PAGE_SIZE),
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const fromChain = indexer.isError;

  const next = useReadContract({
    ...nabbMarket,
    functionName: "nextDropId",
    query: { enabled: fromChain, refetchInterval: REFRESH_MS },
  });

  const ids = useMemo(() => {
    if (!fromChain || next.data === undefined) return [];
    const result: bigint[] = [];
    for (let id = next.data - 1n; id >= 1n && result.length < PAGE_SIZE; id--) result.push(id);
    return result;
  }, [fromChain, next.data]);

  const drops = useReadContracts({
    contracts: ids.map((id) => ({ ...nabbMarket, functionName: "getDrop", args: [id] }) as const),
    query: { enabled: ids.length > 0, refetchInterval: REFRESH_MS },
  });

  const chainItems = useMemo(
    () =>
      ids.flatMap((id, i) => {
        const result = drops.data?.[i];
        return result?.status === "success" ? [{ id, drop: result.result as Drop }] : [];
      }),
    [ids, drops.data],
  );

  if (!fromChain) {
    return {
      items: indexer.data ?? [],
      isLoading: indexer.isLoading,
      error: null,
      source: "indexer" as DropsSource,
      refetch: () => void indexer.refetch(),
    };
  }
  return {
    items: chainItems,
    isLoading: next.isLoading || (ids.length > 0 && drops.isLoading),
    error: next.error ?? drops.error,
    source: "chain" as DropsSource,
    refetch: () => {
      void indexer.refetch();
      void next.refetch();
    },
  };
}
