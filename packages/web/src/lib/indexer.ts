import type { IndexedClaim, IndexedDrop, IndexerPage } from "@nabb/config";
import { INDEXER_URL } from "../env";
import type { Drop } from "./drop";
import type { ClaimEvent } from "./flashblocks";

const TIMEOUT_MS = 4_000;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${INDEXER_URL}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Indexer responded ${response.status}`);
  return (await response.json()) as T;
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

export async function fetchRecentDrops(limit: number) {
  const page = await get<IndexerPage<IndexedDrop>>(`/drops?limit=${limit}`);
  return page.items.map(toDrop);
}

export async function fetchDropClaims(dropId: bigint, limit = 50) {
  const page = await get<IndexerPage<IndexedClaim>>(`/drops/${dropId}/claims?limit=${limit}`);
  return page.items.map(toClaim);
}
