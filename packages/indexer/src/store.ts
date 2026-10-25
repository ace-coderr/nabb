import type { Address, Hash } from "viem";

export interface DropRecord {
  id: bigint;
  seller: Address;
  metadataURI: string;
  price: bigint;
  totalUnits: bigint;
  claimedUnits: bigint;
  startTime: bigint;
  endTime: bigint;
  maxPerWallet: number;
  active: boolean;
  createdAt: number;
  createdBlock: bigint;
  createdTx: Hash;
}

export interface ClaimRecord {
  id: string;
  dropId: bigint;
  claimer: Address;
  unitIndex: bigint;
  pricePaid: bigint;
  timestamp: number;
  blockNumber: bigint;
  txHash: Hash;
  logIndex: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * In-memory view of NabbMarket built purely from its events. Every mutation is idempotent, so
 * replaying a block range (after a restart or a retried RPC call) never double-counts.
 */
export class Store {
  private readonly drops = new Map<bigint, DropRecord>();
  /** Drop ids in ascending order. */
  private readonly dropIds: bigint[] = [];
  /** Per-drop claims in ascending unit order. */
  private readonly claimsByDrop = new Map<bigint, ClaimRecord[]>();
  /** All claims in chain order. */
  private readonly claims: ClaimRecord[] = [];
  private readonly claimIds = new Set<string>();

  /** Last block whose events are fully applied. */
  indexedBlock: bigint;
  /** Latest chain head seen by the sync loop. */
  headBlock = 0n;
  /** Wall-clock ms of the last successful sync step. */
  lastSyncedAt = 0;
  /** Set on any change; cleared by whoever persists the store. */
  dirty = false;

  constructor(startBlock: bigint) {
    this.indexedBlock = startBlock - 1n;
  }

  get dropCount(): number {
    return this.drops.size;
  }

  get claimCount(): number {
    return this.claims.length;
  }

  hasDrop(id: bigint): boolean {
    return this.drops.has(id);
  }

  addDrop(drop: DropRecord): boolean {
    if (this.drops.has(drop.id)) return false;
    this.drops.set(drop.id, { ...drop });
    const at = this.dropIds.findIndex((id) => id > drop.id);
    if (at === -1) this.dropIds.push(drop.id);
    else this.dropIds.splice(at, 0, drop.id);
    this.claimsByDrop.set(drop.id, []);
    this.dirty = true;
    return true;
  }

  /** Applies a claim to its drop. Returns false for duplicates or claims on unknown drops. */
  addClaim(claim: ClaimRecord): boolean {
    const drop = this.drops.get(claim.dropId);
    if (!drop || this.claimIds.has(claim.id)) return false;

    this.claimIds.add(claim.id);
    this.claims.push({ ...claim });
    const list = this.claimsByDrop.get(claim.dropId)!;
    const at = list.findIndex((c) => c.unitIndex > claim.unitIndex);
    if (at === -1) list.push({ ...claim });
    else list.splice(at, 0, { ...claim });

    const claimed = claim.unitIndex + 1n;
    if (claimed > drop.claimedUnits) drop.claimedUnits = claimed;
    if (drop.claimedUnits >= drop.totalUnits) drop.active = false;
    this.dirty = true;
    return true;
  }

  closeDrop(id: bigint): boolean {
    const drop = this.drops.get(id);
    if (!drop || !drop.active) return false;
    drop.active = false;
    this.dirty = true;
    return true;
  }

  markIndexed(block: bigint, head: bigint): void {
    if (block > this.indexedBlock) {
      this.indexedBlock = block;
      this.dirty = true;
    }
    this.headBlock = head;
    this.lastSyncedAt = Date.now();
  }

  getDrop(id: bigint): DropRecord | undefined {
    const drop = this.drops.get(id);
    return drop && { ...drop };
  }

  /** Newest drops first. `before` is an exclusive drop id cursor. */
  listDrops({ limit, before }: { limit: number; before?: bigint }): Page<DropRecord> {
    const items: DropRecord[] = [];
    let i = this.dropIds.length - 1;
    if (before !== undefined) while (i >= 0 && this.dropIds[i]! >= before) i--;
    for (; i >= 0 && items.length < limit; i--)
      items.push({ ...this.drops.get(this.dropIds[i]!)! });
    const last = items.at(-1);
    return { items, nextCursor: i >= 0 && last ? last.id.toString() : null };
  }

  /** Newest claims of one drop first. `before` is an exclusive unit-index cursor. */
  listDropClaims(
    dropId: bigint,
    { limit, before }: { limit: number; before?: bigint },
  ): Page<ClaimRecord> | undefined {
    const list = this.claimsByDrop.get(dropId);
    if (!list) return undefined;
    const items: ClaimRecord[] = [];
    let i = list.length - 1;
    if (before !== undefined) while (i >= 0 && list[i]!.unitIndex >= before) i--;
    for (; i >= 0 && items.length < limit; i--) items.push({ ...list[i]! });
    const last = items.at(-1);
    return { items, nextCursor: i >= 0 && last ? last.unitIndex.toString() : null };
  }

  /** Newest claims across all drops first. `before` is an opaque position cursor. */
  listClaims({ limit, before }: { limit: number; before?: number }): Page<ClaimRecord> {
    const items: ClaimRecord[] = [];
    let i = Math.min(before ?? this.claims.length, this.claims.length) - 1;
    for (; i >= 0 && items.length < limit; i--) items.push({ ...this.claims[i]! });
    return { items, nextCursor: i >= 0 ? String(i + 1) : null };
  }

  toSnapshot(meta: SnapshotMeta): Snapshot {
    return {
      version: SNAPSHOT_VERSION,
      ...meta,
      indexedBlock: this.indexedBlock.toString(),
      drops: this.dropIds.map((id) => serializeDrop(this.drops.get(id)!)),
      claims: this.claims.map(serializeClaim),
    };
  }

  /** Rebuilds a store from a snapshot, or returns undefined if it belongs to another deployment. */
  static fromSnapshot(snapshot: Snapshot, meta: SnapshotMeta): Store | undefined {
    if (
      snapshot.version !== SNAPSHOT_VERSION ||
      snapshot.chainId !== meta.chainId ||
      snapshot.contract.toLowerCase() !== meta.contract.toLowerCase()
    ) {
      return undefined;
    }
    const store = new Store(BigInt(snapshot.indexedBlock) + 1n);
    for (const drop of snapshot.drops) store.addDrop(deserializeDrop(drop));
    for (const claim of snapshot.claims) store.addClaim(deserializeClaim(claim));
    store.dirty = false;
    return store;
  }
}

// ---------------------------------------------------------------------------------------------
// Snapshot format
// ---------------------------------------------------------------------------------------------

const SNAPSHOT_VERSION = 1;

export interface SnapshotMeta {
  chainId: number;
  contract: Address;
}

type Serialized<T> = { [K in keyof T]: T[K] extends bigint ? string : T[K] };

export interface Snapshot extends SnapshotMeta {
  version: number;
  indexedBlock: string;
  drops: Serialized<DropRecord>[];
  claims: Serialized<ClaimRecord>[];
}

export function serializeDrop(d: DropRecord): Serialized<DropRecord> {
  return {
    ...d,
    id: d.id.toString(),
    price: d.price.toString(),
    totalUnits: d.totalUnits.toString(),
    claimedUnits: d.claimedUnits.toString(),
    startTime: d.startTime.toString(),
    endTime: d.endTime.toString(),
    createdBlock: d.createdBlock.toString(),
  };
}

export function serializeClaim(c: ClaimRecord): Serialized<ClaimRecord> {
  return {
    ...c,
    dropId: c.dropId.toString(),
    unitIndex: c.unitIndex.toString(),
    pricePaid: c.pricePaid.toString(),
    blockNumber: c.blockNumber.toString(),
  };
}

function deserializeDrop(d: Serialized<DropRecord>): DropRecord {
  return {
    ...d,
    id: BigInt(d.id),
    price: BigInt(d.price),
    totalUnits: BigInt(d.totalUnits),
    claimedUnits: BigInt(d.claimedUnits),
    startTime: BigInt(d.startTime),
    endTime: BigInt(d.endTime),
    createdBlock: BigInt(d.createdBlock),
  };
}

function deserializeClaim(c: Serialized<ClaimRecord>): ClaimRecord {
  return {
    ...c,
    dropId: BigInt(c.dropId),
    unitIndex: BigInt(c.unitIndex),
    pricePaid: BigInt(c.pricePaid),
    blockNumber: BigInt(c.blockNumber),
  };
}
