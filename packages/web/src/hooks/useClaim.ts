import { giwaSepolia, nabbMarket } from "@nabb/config";
import { useCallback, useRef, useState } from "react";
import type { Address, Hash, TransactionReceipt } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { describeError, isTransientRpcError } from "../lib/errors";
import {
  claimFromReceipt,
  simulateClaimPending,
  standardClient,
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
      /** The standard RPC could not be reached for the sealed receipt (the claim itself landed). */
      finalFailed?: boolean;
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
const MAY_STILL_LAND =
  " Your transaction may still confirm — check the explorer before trying again.";

/**
 * Dry-runs the claim so sold-out, ended and limit errors show before the wallet prompt. Reads the
 * latest flashblock; if that RPC is unreachable or rate-limited it falls back to the standard RPC,
 * and if both are unreachable it lets the wallet decide rather than blocking a valid claim. Only a
 * genuine contract revert stops the claim.
 */
async function simulateBeforeSending(dropId: bigint, price: bigint, account: Address) {
  try {
    await simulateClaimPending(dropId, price, account);
    return;
  } catch (error) {
    if (!isTransientRpcError(error)) throw error;
  }
  try {
    await standardClient.simulateContract({
      ...nabbMarket,
      functionName: "claim",
      args: [dropId],
      value: price,
      account,
    });
  } catch (error) {
    if (!isTransientRpcError(error)) throw error;
  }
}

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
  // Guards against a second click starting another claim before the first has rendered as busy.
  const inFlight = useRef(false);

  const claim = useCallback(
    async (dropId: bigint, price: bigint) => {
      if (!address || inFlight.current) return;
      inFlight.current = true;
      let hash: Hash | undefined;
      try {
        setState({ status: "confirming" });
        await ensureChain();
        await simulateBeforeSending(dropId, price, address);

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
        // If we return early below, nobody awaits this; don't leave an unhandled rejection behind.
        finalPromise.catch(() => undefined);
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

        let final: TransactionReceipt | undefined;
        try {
          final = await finalPromise;
        } catch (error) {
          // Without a preconfirmation there is nothing to show yet, so this is a real failure.
          if (!flash) throw error;
        }
        const finalMs = performance.now() - sentAt;
        const settledHash = hash;
        if (!final) {
          // Preconfirmed, but the sealed receipt could not be fetched: keep the success on screen.
          setState((prev) =>
            prev.status === "nabbed" && prev.hash === settledHash
              ? { ...prev, finalFailed: true }
              : prev,
          );
        } else if (final.status !== "success") {
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
        // Once a hash exists the transaction may still land even though waiting for it failed.
        const base = describeError(error);
        setState({ status: "error", message: hash ? base + MAY_STILL_LAND : base, hash });
      } finally {
        inFlight.current = false;
        onSettled?.();
      }
    },
    [address, ensureChain, writeContractAsync, onPreconfirmed, onSettled],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, claim, reset };
}
