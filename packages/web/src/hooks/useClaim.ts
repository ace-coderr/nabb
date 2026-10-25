import { giwaSepolia, nabbMarket, nabbMarketAbi } from "@nabb/config";
import { useCallback, useState } from "react";
import { parseEventLogs, type Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { describeError } from "../lib/errors";
import { useEnsureChain } from "./useEnsureChain";

export type ClaimState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "pending"; hash: Hash }
  | { status: "nabbed"; hash: Hash; unitIndex: bigint | undefined }
  | { status: "error"; message: string; hash?: Hash };

export function useClaim(onSettled?: () => void) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: giwaSepolia.id });
  const { writeContractAsync } = useWriteContract();
  const { ensureChain } = useEnsureChain();
  const [state, setState] = useState<ClaimState>({ status: "idle" });

  const claim = useCallback(
    async (dropId: bigint, price: bigint) => {
      if (!address || !publicClient) return;
      let hash: Hash | undefined;
      try {
        setState({ status: "confirming" });
        await ensureChain();

        // Surface sold-out / limit / timing errors before the wallet prompt.
        await publicClient.simulateContract({
          ...nabbMarket,
          functionName: "claim",
          args: [dropId],
          value: price,
          account: address,
        });

        hash = await writeContractAsync({
          ...nabbMarket,
          functionName: "claim",
          args: [dropId],
          value: price,
          chainId: giwaSepolia.id,
        });
        setState({ status: "pending", hash });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          setState({
            status: "error",
            hash,
            message: "Your claim reverted — someone may have nabbed the last unit first.",
          });
          return;
        }
        const [claimed] = parseEventLogs({
          abi: nabbMarketAbi,
          eventName: "Claimed",
          logs: receipt.logs,
        });
        setState({ status: "nabbed", hash, unitIndex: claimed?.args.unitIndex });
      } catch (error) {
        setState({ status: "error", message: describeError(error), hash });
      } finally {
        onSettled?.();
      }
    },
    [address, publicClient, ensureChain, writeContractAsync, onSettled],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, claim, reset };
}
