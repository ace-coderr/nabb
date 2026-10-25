import { nabbMarket } from "@nabb/config";
import { zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { contractErrorName } from "../lib/errors";

const REFRESH_MS = 4_000;

/** On-chain state of one drop plus how many units the connected wallet has claimed. */
export function useDrop(dropId: bigint | undefined) {
  const { address } = useAccount();
  const enabled = dropId !== undefined;

  const drop = useReadContract({
    ...nabbMarket,
    functionName: "getDrop",
    args: [dropId ?? 0n],
    query: { enabled, refetchInterval: REFRESH_MS, retry: false },
  });

  const walletClaims = useReadContract({
    ...nabbMarket,
    functionName: "claimedByWallet",
    args: [dropId ?? 0n, address ?? zeroAddress],
    query: { enabled: enabled && address !== undefined, refetchInterval: REFRESH_MS },
  });

  return {
    drop: drop.data,
    isLoading: drop.isLoading,
    notFound: contractErrorName(drop.error) === "DropNotFound",
    error: drop.error,
    walletClaims: walletClaims.data ?? 0n,
    refetch: async () => {
      await Promise.all([drop.refetch(), walletClaims.refetch()]);
    },
  };
}
