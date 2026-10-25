import { giwaSepolia, nabbMarket } from "@nabb/config";
import { useCallback, useState } from "react";
import type { Hash } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { describeError } from "../lib/errors";
import {
  claimFromReceipt,
  simulateClaimPending,
  waitForFinalReceipt,
  waitForFlashReceipt,
  type ClaimEvent,
} from "../lib/flashblocks";
import { useEnsureChain } from "./useEnsureChain";

export type ClaimState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "pending"; hash: Hash; sentAt: number }
  | {
      status: "nabbed";
      hash: Hash;
      unitIndex: bigint | undefined;
      /** Broadcast → first receipt, in ms. */
      latencyMs: number;
      /** Which RPC produced that first receipt. */
      via: "flashblocks" | "standard";
      /** Set once the standard RPC returns the sealed receipt. */
      final?: { blockNumber: bigint; ms: number };
    }
  | { status: "error"; message: string; hash?: Hash };

export interface ClaimCallbacks {
  /**
   * The claim has a first receipt. `broadcastAt` is the wall-clock time (ms) the transaction was
   * sent, so callers can tell which of their cached reads predate it.
   */
  onPreconfirmed?: (claim: ClaimEvent | undefined, broadcastAt: number) => void;
  /** The flow ended (success, revert or error); a good moment to re-read state. */
  onSettled?: () => void;
}

const REVERTED = "Your claim reverted — someone may have nabbed the last unit first.";

/**
 * Claim flow: dry-run against the latest flashblock, send through the wallet, then race to the
 * first preconfirmed receipt on the Flashblocks RPC. The standard RPC's sealed receipt is awaited
 * in the background as the final word.
 */
export function useClaim({ onPreconfirmed, onSettled }: ClaimCallbacks = {}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { ensureChain } = useEnsureChain();
  const [state, setState] = useState<ClaimState>({ status: "idle" });

  const claim = useCallback(
    async (dropId: bigint, price: bigint) => {
      if (!address) return;
      let hash: Hash | undefined;
      try {
        setState({ status: "confirming" });
        await ensureChain();
        await simulateClaimPending(dropId, price, address);

        hash = await writeContractAsync({
          ...nabbMarket,
          functionName: "claim",
          args: [dropId],
          value: price,
          chainId: giwaSepolia.id,
        });
        // The clock starts once the transaction is broadcast, not while the wallet prompt is open.
        const sentAt = performance.now();
        const broadcastAt = Date.now();
        setState({ status: "pending", hash, sentAt });

        const finalPromise = waitForFinalReceipt(hash);
        const flash = await waitForFlashReceipt(hash, { startedAt: sentAt });

        if (flash) {
          if (flash.receipt.status !== "success") {
            setState({ status: "error", hash, message: REVERTED });
            return;
          }
          const claim = claimFromReceipt(flash.receipt);
          setState({
            status: "nabbed",
            hash,
            unitIndex: claim?.unitIndex,
            latencyMs: flash.elapsedMs,
            via: "flashblocks",
          });
          onPreconfirmed?.(claim, broadcastAt);
        }

        const final = await finalPromise;
        const finalMs = performance.now() - sentAt;
        const settledHash = hash;
        if (final.status !== "success") {
          setState({ status: "error", hash: settledHash, message: REVERTED });
        } else if (flash) {
          setState((prev) =>
            prev.status === "nabbed" && prev.hash === settledHash
              ? { ...prev, final: { blockNumber: final.blockNumber, ms: finalMs } }
              : prev,
          );
        } else {
          // Flashblocks didn't answer in time; the sealed receipt is the first confirmation.
          const claim = claimFromReceipt(final);
          onPreconfirmed?.(claim, broadcastAt);
          setState({
            status: "nabbed",
            hash: settledHash,
            unitIndex: claim?.unitIndex,
            latencyMs: finalMs,
            via: "standard",
            final: { blockNumber: final.blockNumber, ms: finalMs },
          });
        }
      } catch (error) {
        setState({ status: "error", message: describeError(error), hash });
      } finally {
        onSettled?.();
      }
    },
    [address, ensureChain, writeContractAsync, onPreconfirmed, onSettled],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, claim, reset };
}
