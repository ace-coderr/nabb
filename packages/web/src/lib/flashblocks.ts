/**
 * Every Flashblocks read in the app lives in this module.
 *
 * GIWA's sequencer streams "flashblocks" — ~200ms slices of the block it is building — ahead of
 * each sealed block. The Flashblocks RPC serves that preconfirmed state: a receipt exists as soon
 * as the transaction lands in a flashblock, and the `pending` block tag resolves to the latest
 * flashblock. The standard RPC only sees sealed blocks and remains the source of truth.
 */
import { giwaSepolia, nabbMarket, nabbMarketAbi, nabbMarketDeployBlock } from "@nabb/config";
import {
  createPublicClient,
  getAbiItem,
  http,
  parseEventLogs,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { FLASHBLOCKS_RPC_URL, STANDARD_RPC_URL } from "../env";
import { contractErrorName } from "./errors";

/** Sealed-block reads and final receipts. */
export const standardClient = createPublicClient({
  chain: giwaSepolia,
  transport: http(STANDARD_RPC_URL),
});

/** Preconfirmed reads. No retries or caching: a stale answer is worse than the next poll. */
export const flashClient = createPublicClient({
  chain: giwaSepolia,
  transport: http(FLASHBLOCKS_RPC_URL, { retryCount: 0, timeout: 5_000 }),
  cacheTime: 0,
});

const claimedEvent = getAbiItem({ abi: nabbMarketAbi, name: "Claimed" });

// ---------------------------------------------------------------------------------------------
// Instant confirmation
// ---------------------------------------------------------------------------------------------

export interface FlashReceipt {
  receipt: TransactionReceipt;
  /** Milliseconds from `startedAt` until the preconfirmed receipt came back. */
  elapsedMs: number;
}

export interface WaitForFlashReceiptOptions {
  /** `performance.now()` when the transaction was broadcast. */
  startedAt?: number;
  intervalMs?: number;
  timeoutMs?: number;
  /** Cap on overlapping requests when the RPC is slower than the poll interval. */
  maxInFlight?: number;
}

/**
 * Polls the Flashblocks RPC for a receipt every `intervalMs` until one appears or `timeoutMs`
 * passes (resolves `undefined`). Requests overlap so a slow response doesn't delay the next probe.
 */
export function waitForFlashReceipt(
  hash: Hash,
  {
    startedAt = performance.now(),
    intervalMs = 50,
    timeoutMs = 3_000,
    maxInFlight = 4,
  }: WaitForFlashReceiptOptions = {},
): Promise<FlashReceipt | undefined> {
  return new Promise((resolve) => {
    let done = false;
    let inFlight = 0;

    const finish = (result: FlashReceipt | undefined) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearTimeout(deadline);
      resolve(result);
    };

    const probe = async () => {
      if (done || inFlight >= maxInFlight) return;
      inFlight++;
      try {
        const receipt = await flashClient.getTransactionReceipt({ hash });
        finish({ receipt, elapsedMs: performance.now() - startedAt });
      } catch {
        // Not preconfirmed yet (or a transient RPC error) — the next probe tries again.
      } finally {
        inFlight--;
      }
    };

    const timer = setInterval(() => void probe(), intervalMs);
    const deadline = setTimeout(
      () => finish(undefined),
      Math.max(0, timeoutMs - (performance.now() - startedAt)),
    );
    void probe();
  });
}

/** Final receipt from the standard RPC (sealed block). */
export function waitForFinalReceipt(hash: Hash): Promise<TransactionReceipt> {
  return standardClient.waitForTransactionReceipt({ hash, pollingInterval: 250 });
}

// ---------------------------------------------------------------------------------------------
// Preconfirmed contract state
// ---------------------------------------------------------------------------------------------

export function readDropPending(dropId: bigint) {
  return flashClient.readContract({
    ...nabbMarket,
    functionName: "getDrop",
    args: [dropId],
    blockTag: "pending",
  });
}

export function readWalletClaimsPending(dropId: bigint, wallet: Address) {
  return flashClient.readContract({
    ...nabbMarket,
    functionName: "claimedByWallet",
    args: [dropId, wallet],
    blockTag: "pending",
  });
}

/** Dry-runs a claim against the latest flashblock so stale "still available" states fail fast. */
export function simulateClaimPending(dropId: bigint, price: bigint, account: Address) {
  return flashClient.simulateContract({
    ...nabbMarket,
    functionName: "claim",
    args: [dropId],
    value: price,
    account,
    blockTag: "pending",
  });
}

// ---------------------------------------------------------------------------------------------
// Live claim feed
// ---------------------------------------------------------------------------------------------

export interface ClaimEvent {
  /** `${txHash}:${logIndex}` — stable across the preconfirmed and sealed views of a log. */
  id: string;
  dropId: bigint;
  claimer: Address;
  unitIndex: bigint;
  pricePaid: bigint;
  /** Block timestamp (seconds) emitted by the contract. */
  timestamp: number;
  txHash: Hash;
  logIndex: number;
  blockNumber: bigint | null;
}

export type ClaimSource = "backfill" | "live";

export interface WatchClaimsOptions {
  dropId: bigint;
  onClaims: (claims: ClaimEvent[], source: ClaimSource) => void;
  onStatus?: (status: { ok: boolean; error?: unknown }) => void;
  intervalMs?: number;
  /** Most claims the history backfill fetches (newest first). */
  historyLimit?: number;
}

const HEAD_REFRESH_MS = 2_000;
// History is read from sealed blocks in ranges this size, a few at a time, newest first.
const HISTORY_CHUNK_BLOCKS = 10_000n;
const HISTORY_PARALLEL = 3;
const HISTORY_ATTEMPTS = 3;
// One slow or dropped poll is normal on public RPCs; only a streak means the feed is down.
const FAILURES_BEFORE_DOWN = 3;
// Re-read a few sealed blocks each poll so nothing is missed while a block is being finalised;
// duplicates are dropped by id.
const OVERLAP_BLOCKS = 5n;

/**
 * Emits every `Claimed` log for a drop exactly once:
 * - a history backfill that walks sealed blocks back from the head, newest first, until it has
 *   every claim the drop reports (up to `historyLimit`) or reaches the deploy block. It runs
 *   beside the live loop so a long walk never delays new claims;
 * - a live loop that polls up to the `pending` tag (latest flashblock) every `intervalMs`.
 * Returns an unsubscribe function.
 */
export function watchPendingClaims({
  dropId,
  onClaims,
  onStatus,
  intervalMs = 250,
  historyLimit = 50,
}: WatchClaimsOptions): () => void {
  const seen = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cursor: bigint | undefined;
  let head = 0n;
  let headCheckedAt = 0;
  let failures = 0;

  const emit = (logs: ClaimLog[], source: ClaimSource) => {
    if (stopped) return;
    const fresh: ClaimEvent[] = [];
    for (const log of logs) {
      const claim = toClaimEvent(log);
      if (!claim || seen.has(claim.id)) continue;
      seen.add(claim.id);
      fresh.push(claim);
    }
    if (fresh.length > 0) onClaims(fresh, source);
  };

  const backfill = async (toBlock: bigint) => {
    // The drop's claim count says how much history exists, so the walk can stop early.
    let wanted = BigInt(historyLimit);
    try {
      const drop = await readDropPending(dropId);
      if (drop.claimedUnits < wanted) wanted = drop.claimedUnits;
    } catch (error) {
      if (contractErrorName(error) === "DropNotFound") return;
    }

    let to = toBlock;
    while (!stopped && to >= nabbMarketDeployBlock && BigInt(seen.size) < wanted) {
      const ranges: [bigint, bigint][] = [];
      while (ranges.length < HISTORY_PARALLEL && to >= nabbMarketDeployBlock) {
        const from = to - HISTORY_CHUNK_BLOCKS + 1n;
        const start = from > nabbMarketDeployBlock ? from : nabbMarketDeployBlock;
        ranges.push([start, to]);
        to = start - 1n;
      }
      for (let attempt = 1; ; attempt++) {
        try {
          const results = await Promise.all(
            ranges.map(([from, upTo]) => fetchClaimLogs(dropId, from, upTo, standardClient)),
          );
          emit(results.flat(), "backfill");
          break;
        } catch (error) {
          if (attempt >= HISTORY_ATTEMPTS || stopped) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }
  };

  const tick = async () => {
    const startedAt = Date.now();
    try {
      if (cursor === undefined || startedAt - headCheckedAt > HEAD_REFRESH_MS) {
        head = await flashClient.getBlockNumber();
        headCheckedAt = startedAt;
        if (cursor === undefined) {
          cursor = head - OVERLAP_BLOCKS;
          // A failed history walk leaves older rows out but says nothing about the live feed.
          backfill(cursor - 1n).catch(() => undefined);
        }
      }

      emit(await fetchClaimLogs(dropId, cursor, "pending"), "live");

      const next = head - OVERLAP_BLOCKS;
      if (next > cursor) cursor = next;
      failures = 0;
      if (!stopped) onStatus?.({ ok: true });
    } catch (error) {
      failures++;
      if (!stopped && failures >= FAILURES_BEFORE_DOWN) onStatus?.({ ok: false, error });
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), Math.max(0, intervalMs - (Date.now() - startedAt)));
      }
    }
  };

  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

function fetchClaimLogs(
  dropId: bigint,
  fromBlock: bigint,
  toBlock: bigint | "pending",
  client: typeof flashClient | typeof standardClient = flashClient,
) {
  return client.getLogs({
    address: nabbMarket.address,
    event: claimedEvent,
    args: { dropId },
    fromBlock,
    toBlock,
  });
}

type ClaimLog = Awaited<ReturnType<typeof fetchClaimLogs>>[number];

/** The `Claimed` event in a claim receipt, in the same shape the live feed emits. */
export function claimFromReceipt(receipt: TransactionReceipt): ClaimEvent | undefined {
  const [log] = parseEventLogs({ abi: nabbMarketAbi, eventName: "Claimed", logs: receipt.logs });
  if (!log) return undefined;
  const { dropId, claimer, unitIndex, pricePaid, timestamp } = log.args;
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    dropId,
    claimer,
    unitIndex,
    pricePaid,
    timestamp: Number(timestamp),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
  };
}

function toClaimEvent(log: ClaimLog): ClaimEvent | undefined {
  if (log.removed || !log.transactionHash || log.logIndex === null) return undefined;
  const { dropId, claimer, unitIndex, pricePaid, timestamp } = log.args;
  if (dropId === undefined || !claimer || unitIndex === undefined || pricePaid === undefined) {
    return undefined;
  }
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    dropId,
    claimer,
    unitIndex,
    pricePaid,
    timestamp: Number(timestamp ?? 0n),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
  };
}
