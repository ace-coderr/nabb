import { nabbMarket, nabbMarketAbi, type giwaSepolia } from "@nabb/config";
import { getAbiItem, type PublicClient, type Transport } from "viem";
import type { Store } from "./store";

const events = [
  getAbiItem({ abi: nabbMarketAbi, name: "DropCreated" }),
  getAbiItem({ abi: nabbMarketAbi, name: "Claimed" }),
  getAbiItem({ abi: nabbMarketAbi, name: "DropClosed" }),
] as const;

export interface SyncLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface SyncOptions {
  client: PublicClient<Transport, typeof giwaSepolia>;
  store: Store;
  log: SyncLogger;
  /** Blocks to stay behind the head, as protection against shallow reorgs. */
  confirmations: bigint;
  pollIntervalMs: number;
  /** Max blocks per eth_getLogs request. */
  chunkSize?: bigint;
}

const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Indexes one block range from the standard RPC (sealed blocks only). Returns false when already
 * caught up with `head - confirmations`.
 */
export async function syncStep({
  client,
  store,
  log,
  confirmations,
  chunkSize = 10_000n,
}: SyncOptions): Promise<boolean> {
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const target = head - confirmations;
  if (store.indexedBlock >= target) {
    store.markIndexed(store.indexedBlock, head);
    return false;
  }

  const fromBlock = store.indexedBlock + 1n;
  const toBlock = fromBlock + chunkSize - 1n < target ? fromBlock + chunkSize - 1n : target;
  const logs = await client.getLogs({
    address: nabbMarket.address,
    events,
    fromBlock,
    toBlock,
    strict: true,
  });

  // A drop's static fields (seller, URI, price, units, window, limit) never change, so they are
  // read at the latest block — no archive node needed. Counters and status come from events.
  const created = logs.filter((l) => l.eventName === "DropCreated");
  const details = await Promise.all(
    created.map((l) =>
      client.readContract({ ...nabbMarket, functionName: "getDrop", args: [l.args.dropId] }),
    ),
  );
  const createdBlocks = [...new Set(created.map((l) => l.blockNumber))];
  const blockTimes = new Map(
    await Promise.all(
      createdBlocks.map(
        async (n) => [n, Number((await client.getBlock({ blockNumber: n })).timestamp)] as const,
      ),
    ),
  );

  let applied = 0;
  for (const event of logs) {
    switch (event.eventName) {
      case "DropCreated": {
        const d = details[created.indexOf(event)]!;
        const added = store.addDrop({
          id: event.args.dropId,
          seller: d.seller,
          metadataURI: d.metadataURI,
          price: d.price,
          totalUnits: d.totalUnits,
          claimedUnits: 0n,
          startTime: d.startTime,
          endTime: d.endTime,
          maxPerWallet: d.maxPerWallet,
          active: true,
          createdAt: blockTimes.get(event.blockNumber) ?? 0,
          createdBlock: event.blockNumber,
          createdTx: event.transactionHash,
        });
        if (added) applied++;
        break;
      }
      case "Claimed": {
        const { dropId, claimer, unitIndex, pricePaid, timestamp } = event.args;
        if (!store.hasDrop(dropId)) {
          log.warn({ dropId: dropId.toString() }, "claim for a drop created before START_BLOCK");
          break;
        }
        const added = store.addClaim({
          id: `${event.transactionHash}:${event.logIndex}`,
          dropId,
          claimer,
          unitIndex,
          pricePaid,
          timestamp: Number(timestamp),
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        });
        if (added) applied++;
        break;
      }
      case "DropClosed": {
        if (store.closeDrop(event.args.dropId)) applied++;
        break;
      }
    }
  }

  store.markIndexed(toBlock, head);
  if (applied > 0 || toBlock < target) {
    log.info(
      { fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), events: applied },
      toBlock < target ? "backfilling" : "indexed",
    );
  }
  return toBlock < target;
}

/** Runs `syncStep` until stopped, backing off exponentially on RPC errors. */
export function startSync(options: SyncOptions): { stop: () => Promise<void> } {
  let stopped = false;
  let failures = 0;

  const done = (async () => {
    while (!stopped) {
      try {
        const behind = await syncStep(options);
        failures = 0;
        if (!behind) await sleep(options.pollIntervalMs);
      } catch (error) {
        failures++;
        const delay = Math.min(options.pollIntervalMs * 2 ** failures, MAX_BACKOFF_MS);
        options.log.error(
          { err: error instanceof Error ? error.message : String(error), retryInMs: delay },
          "sync step failed",
        );
        await sleep(delay);
      }
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await done;
    },
  };
}
