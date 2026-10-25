import { giwaSepolia } from "@nabb/config";
import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";

/** Whether the connected wallet is on GIWA Sepolia, plus a function that switches it there. */
export function useEnsureChain() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const onGiwa = chainId === giwaSepolia.id;

  const ensureChain = useCallback(async () => {
    // Adds the chain to the wallet first if it doesn't know it yet.
    if (!onGiwa) await switchChainAsync({ chainId: giwaSepolia.id });
  }, [onGiwa, switchChainAsync]);

  return { onGiwa, wrongChain: isConnected && !onGiwa, ensureChain, switching: isPending };
}
