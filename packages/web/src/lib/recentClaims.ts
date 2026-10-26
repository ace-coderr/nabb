import { nabbMarket, nabbMarketAbi, nabbMarketDeployBlock } from "@nabb/config";
import { getAbiItem } from "viem";
import { standardClient, type ClaimEvent } from "./flashblocks";
import { fetchDropClaims, fetchRecentClaims, indexerAvailable } from "./indexer";

const claimedEvent = getAbiItem({ abi: nabbMarketAbi, name: "Claimed" });

// Sealed history is read newest-first in 10k-block ranges, a few at a time, and stops as soon as
// enough claims are found. The cap bounds the worst case on a quiet chain (~4.6 days of 1s blocks).
const RANGE_BLOCKS = 10_000n;
const PARALLEL = 4;
const MAX_RANGES = 40;

/**
 * Reads `Claimed` logs from the standard RPC, newest first, optionally for one drop, until `wanted`
 * claims are found, the deploy block is reached or the range cap is hit.
 */
async function readClaimsNewestFirst(wanted: number, dropId?: bigint): Promise<ClaimEvent[]> {
  const head = await standardClient.getBlockNumber();
  const found: ClaimEvent[] = [];
  let to = head;
  let ranges = 0;

  while (found.length < wanted && to >= nabbMarketDeployBlock && ranges < MAX_RANGES) {
    const batch: [bigint, bigint][] = [];
    while (
      batch.length < PARALLEL &&
      to >= nabbMarketDeployBlock &&
      ranges + batch.length < MAX_RANGES
    ) {
      const from = to - RANGE_BLOCKS + 1n;
      const start = from > nabbMarketDeployBlock ? from : nabbMarketDeployBlock;
      batch.push([start, to]);
      to = start - 1n;
    }
    ranges += batch.length;

    const logs = (
      await Promise.all(
        batch.map(([fromBlock, toBlock]) =>
          standardClient.getLogs({
            address: nabbMarket.address,
            event: claimedEvent,
            args: dropId === undefined ? undefined : { dropId },
            fromBlock,
            toBlock,
          }),
        ),
      )
    ).flat();

    for (const log of logs) {
      const { dropId: id, claimer, unitIndex, pricePaid, timestamp } = log.args;
      if (
        log.removed ||
        log.transactionHash === null ||
        log.logIndex === null ||
        id === undefined ||
        claimer === undefined ||
        unitIndex === undefined ||
        pricePaid === undefined
      ) {
        continue;
      }
      found.push({
        id: `${log.transactionHash}:${log.logIndex}`,
        dropId: id,
        claimer,
        unitIndex,
        pricePaid,
        timestamp: Number(timestamp ?? 0n),
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
      });
    }
  }

  return found
    .sort((a, b) => b.timestamp - a.timestamp || b.logIndex - a.logIndex)
    .slice(0, wanted);
}

/**
 * The most recent claims across every drop, newest first. One-off: used once at startup to fill the
 * activity buffer so the ticker and live column are never blank. An indexer, if a healthy one is
 * configured, answers in a single request; otherwise the chain is read directly.
 */
export async function loadRecentClaims(limit = 20): Promise<ClaimEvent[]> {
  if (await indexerAvailable()) {
    try {
      return await fetchRecentClaims(limit);
    } catch {
      // Fall through to the chain.
    }
  }
  return readClaimsNewestFirst(limit);
}

/**
 * One drop's recent claims, newest first, read entirely from the standard RPC. Used as the history
 * source when the Flashblocks RPC cannot be reached, so a drop's feed is never empty just because
 * the preconfirmation endpoint is down.
 */
export async function loadDropClaims(dropId: bigint, limit = 50): Promise<ClaimEvent[]> {
  if (await indexerAvailable()) {
    try {
      return await fetchDropClaims(dropId, limit);
    } catch {
      // Fall through to the chain.
    }
  }
  let wanted = limit;
  try {
    const drop = await standardClient.readContract({
      ...nabbMarket,
      functionName: "getDrop",
      args: [dropId],
    });
    wanted = Math.min(limit, Number(drop.claimedUnits));
  } catch {
    // Unknown claim count: look for up to `limit`.
  }
  return wanted > 0 ? readClaimsNewestFirst(wanted, dropId) : [];
}
