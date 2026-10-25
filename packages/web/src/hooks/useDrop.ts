import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAccount } from "wagmi";
import type { Drop } from "../lib/drop";
import { contractErrorName } from "../lib/errors";
import { readDropPending, readWalletClaimsPending, type ClaimEvent } from "../lib/flashblocks";

// The live claim feed triggers an immediate refetch on every new claim; this is only a backstop.
const REFRESH_MS = 3_000;

/**
 * Preconfirmed state of one drop (read from the latest flashblock) plus how many units the
 * connected wallet has claimed.
 */
export function useDrop(dropId: bigint | undefined) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const enabled = dropId !== undefined;
  const key = dropId?.toString();
  const dropKey = ["drop", key] as const;
  const walletKey = ["walletClaims", key, address] as const;

  const drop = useQuery({
    queryKey: dropKey,
    queryFn: () => readDropPending(dropId!),
    enabled,
    refetchInterval: REFRESH_MS,
    retry: (failures, error) => contractErrorName(error) !== "DropNotFound" && failures < 2,
  });

  const walletClaims = useQuery({
    queryKey: walletKey,
    queryFn: () => readWalletClaimsPending(dropId!, address!),
    enabled: enabled && address !== undefined,
    refetchInterval: REFRESH_MS,
  });

  /**
   * Moves the claimed counter forward as soon as claims are seen, without waiting for the next
   * read. Unit indexes are sequential, so the highest one seen is a lower bound for
   * `claimedUnits` — applying the same claim twice is harmless.
   */
  const applyClaims = useCallback(
    (claims: ClaimEvent[]) => {
      if (key === undefined || claims.length === 0) return;
      const claimed = claims.reduce(
        (max, c) => (c.unitIndex + 1n > max ? c.unitIndex + 1n : max),
        0n,
      );
      queryClient.setQueryData<Drop>(["drop", key], (d) =>
        d && claimed > d.claimedUnits ? { ...d, claimedUnits: claimed } : d,
      );
    },
    [queryClient, key],
  );

  /**
   * Counts the wallet's own just-preconfirmed claim. Only data read before the broadcast is bumped
   * (anything newer may already include it); a fresh read follows either way.
   */
  const applyOwnClaim = useCallback(
    (broadcastAt: number) => {
      if (key === undefined || address === undefined) return;
      const queryKey = ["walletClaims", key, address];
      const state = queryClient.getQueryState<bigint>(queryKey);
      void queryClient.cancelQueries({ queryKey });
      if (state?.data !== undefined && state.dataUpdatedAt < broadcastAt) {
        queryClient.setQueryData<bigint>(queryKey, state.data + 1n);
      }
      void queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, key, address],
  );

  return {
    drop: drop.data,
    isLoading: drop.isLoading,
    notFound: contractErrorName(drop.error) === "DropNotFound",
    error: drop.error,
    walletClaims: walletClaims.data ?? 0n,
    applyClaims,
    applyOwnClaim,
    refetch: async () => {
      await Promise.all([drop.refetch(), walletClaims.refetch()]);
    },
  };
}
