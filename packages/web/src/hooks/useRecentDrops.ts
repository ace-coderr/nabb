import { nabbMarket } from "@nabb/config";
import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Drop } from "../lib/drop";

const PAGE_SIZE = 12;

/** The newest drops, read straight from the contract. */
export function useRecentDrops() {
  const next = useReadContract({
    ...nabbMarket,
    functionName: "nextDropId",
    query: { refetchInterval: 5_000 },
  });

  const ids = useMemo(() => {
    if (next.data === undefined) return [];
    const result: bigint[] = [];
    for (let id = next.data - 1n; id >= 1n && result.length < PAGE_SIZE; id--) result.push(id);
    return result;
  }, [next.data]);

  const drops = useReadContracts({
    contracts: ids.map((id) => ({ ...nabbMarket, functionName: "getDrop", args: [id] }) as const),
    query: { enabled: ids.length > 0, refetchInterval: 5_000 },
  });

  const items = useMemo(
    () =>
      ids.flatMap((id, i) => {
        const result = drops.data?.[i];
        return result?.status === "success" ? [{ id, drop: result.result as Drop }] : [];
      }),
    [ids, drops.data],
  );

  return {
    items,
    isLoading: next.isLoading || (ids.length > 0 && drops.isLoading),
    error: next.error ?? drops.error,
    refetch: () => next.refetch(),
  };
}
