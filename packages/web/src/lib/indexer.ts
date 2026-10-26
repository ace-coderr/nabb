import {
  giwaSepolia,
  nabbMarketAddress,
  type IndexedClaim,
  type IndexedDrop,
  type IndexerHealth,
  type IndexerPage,
} from "@nabb/config";
import { INDEXER_URL } from "../env";
import type { Drop } from "./drop";
import type { ClaimEvent } from "./flashblocks";

/**
 * Client for the optional indexer. Nothing here is required: every caller has an on-chain path
 * and only uses the indexer while `indexerAvailable()` says it is healthy.
 */

const TIMEOUT_MS = 4_000;
const HEALTH_TIMEOUT_MS = 2_000;
const HEALTH_TTL_MS = 60_000;

async function get<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  if (!INDEXER_URL) throw new Error("No indexer configured");
  const response = await fetch(`${INDEXER_URL}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Indexer responded ${response.status}`);
  return (await response.json()) as T;
}

let health: { checkedAt: number; ok: Promise<boolean> } | undefined;

/**
 * Whether an indexer is configured, reachable, in sync and serving this chain and contract.
 * Resolves false (never rejects) otherwise; the answer is shared and re-checked every minute.
 */
export function indexerAvailable(): Promise<boolean> {
  if (!INDEXER_URL) return Promise.resolve(false);
  if (health && Date.now() - health.checkedAt < HEALTH_TTL_MS) return health.ok;
  const ok = get<IndexerHealth>("/health", HEALTH_TIMEOUT_MS)
    .then(
      (h) =>
        h.ok &&
        h.chainId === giwaSepolia.id &&
        h.contract.toLowerCase() === nabbMarketAddress.toLowerCase(),
    )
    .catch(() => false);
  health = { checkedAt: Date.now(), ok };
  return ok;
}

export function toDrop(d: IndexedDrop): { id: bigint; drop: Drop } {
  return {
    id: BigInt(d.id),
    drop: {
      seller: d.seller,
      maxPerWallet: d.maxPerWallet,
      active: d.active,
      metadataURI: d.metadataURI,
      price: BigInt(d.price),
      totalUnits: BigInt(d.totalUnits),
      claimedUnits: BigInt(d.claimedUnits),
      startTime: BigInt(d.startTime),
      endTime: BigInt(d.endTime),
    },
  };
}

export function toClaim(c: IndexedClaim): ClaimEvent {
  return {
    id: c.id,
    dropId: BigInt(c.dropId),
    claimer: c.claimer,
    unitIndex: BigInt(c.unitIndex),
    pricePaid: BigInt(c.pricePaid),
    timestamp: c.timestamp,
    txHash: c.txHash,
    logIndex: c.logIndex,
    blockNumber: BigInt(c.blockNumber),
  };
}

/** Newest drops first, up to `limit` (max 100), and whether older ones exist. */
export async function fetchRecentDrops(limit: number) {
  const page = await get<IndexerPage<IndexedDrop>>(`/drops?limit=${Math.min(limit, 100)}`);
  return { items: page.items.map(toDrop), hasMore: page.nextCursor !== null };
}

/** Newest claims across all drops. */
export async function fetchRecentClaims(limit: number) {
  const page = await get<IndexerPage<IndexedClaim>>(`/claims?limit=${Math.min(limit, 200)}`);
  return page.items.map(toClaim);
}

export async function fetchDropClaims(dropId: bigint, limit = 50) {
  const page = await get<IndexerPage<IndexedClaim>>(`/drops/${dropId}/claims?limit=${limit}`);
  return page.items.map(toClaim);
}
