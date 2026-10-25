import { giwaSepolia } from "@nabb/config";
import { parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";

/** Headroom for gas on GIWA Sepolia (a claim costs well under 0.000001 ETH at typical prices). */
export const GAS_BUFFER = parseEther("0.000001");

/**
 * The connected wallet's GIWA Sepolia balance. `canAfford(amount)` is optimistic while the
 * balance is unknown, so a slow read never blocks an action.
 */
export function useWalletBalance() {
  const { address } = useAccount();
  const { data } = useBalance({
    address,
    chainId: giwaSepolia.id,
    query: { enabled: address !== undefined, refetchInterval: 5_000 },
  });
  const balance = data?.value;
  return {
    balance,
    canAfford: (amount: bigint) => balance === undefined || balance >= amount + GAS_BUFFER,
  };
}
