import type { Address, Hash } from "viem";

/**
 * JSON shapes served by the indexer's REST API. Integers that can exceed 2^53 (wei amounts, unit
 * counts, block numbers, timestamps from uint64) are decimal strings.
 */

export interface IndexedDrop {
  id: string;
  seller: Address;
  metadataURI: string;
  price: string;
  totalUnits: string;
  claimedUnits: string;
  startTime: string;
  endTime: string;
  maxPerWallet: number;
  active: boolean;
  /** Unix seconds of the creating block. */
  createdAt: number;
  createdBlock: string;
  createdTx: Hash;
}

export interface IndexedClaim {
  /** `${txHash}:${logIndex}` — the same id the Flashblocks feed uses. */
  id: string;
  dropId: string;
  claimer: Address;
  unitIndex: string;
  pricePaid: string;
  /** Unix seconds, as emitted by the contract. */
  timestamp: number;
  blockNumber: string;
  txHash: Hash;
  logIndex: number;
}

export interface IndexerPage<T> {
  items: T[];
  /** Pass back as `before` to get the next (older) page; null when there is none. */
  nextCursor: string | null;
}

export interface IndexerHealth {
  ok: boolean;
  chainId: number;
  contract: Address;
  indexedBlock: string;
  headBlock: string;
  lagBlocks: string;
  drops: number;
  claims: number;
}
