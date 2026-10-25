import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Hash } from "viem";
import { Store, type ClaimRecord, type DropRecord } from "./store";

const SELLER = "0x1111111111111111111111111111111111111111" as Address;
const ALICE = "0x2222222222222222222222222222222222222222" as Address;
const META = { chainId: 91342, contract: "0x3333333333333333333333333333333333333333" as Address };

function drop(id: bigint, overrides: Partial<DropRecord> = {}): DropRecord {
  return {
    id,
    seller: SELLER,
    metadataURI: `ipfs://drop-${id}`,
    price: 10n,
    totalUnits: 3n,
    claimedUnits: 0n,
    startTime: 0n,
    endTime: 100n,
    maxPerWallet: 2,
    active: true,
    createdAt: 1,
    createdBlock: 10n + id,
    createdTx: `0x${"a".repeat(63)}${id}` as Hash,
    ...overrides,
  };
}

function claim(dropId: bigint, unitIndex: bigint, logIndex = 0): ClaimRecord {
  const txHash = `0x${"b".repeat(60)}${dropId}${unitIndex}${logIndex}`.padEnd(66, "0") as Hash;
  return {
    id: `${txHash}:${logIndex}`,
    dropId,
    claimer: ALICE,
    unitIndex,
    pricePaid: 10n,
    timestamp: 50,
    blockNumber: 100n + unitIndex,
    txHash,
    logIndex,
  };
}

describe("Store", () => {
  it("applies claims, counts units and deactivates a sold-out drop", () => {
    const store = new Store(1n);
    store.addDrop(drop(1n));
    assert.equal(store.addClaim(claim(1n, 0n)), true);
    assert.equal(store.addClaim(claim(1n, 1n)), true);
    assert.equal(store.getDrop(1n)?.claimedUnits, 2n);
    assert.equal(store.getDrop(1n)?.active, true);

    store.addClaim(claim(1n, 2n));
    assert.equal(store.getDrop(1n)?.claimedUnits, 3n);
    assert.equal(store.getDrop(1n)?.active, false);
    assert.equal(store.claimCount, 3);
  });

  it("ignores duplicate claims and claims on unknown drops", () => {
    const store = new Store(1n);
    store.addDrop(drop(1n));
    const c = claim(1n, 0n);
    assert.equal(store.addClaim(c), true);
    assert.equal(store.addClaim({ ...c }), false);
    assert.equal(store.addClaim(claim(9n, 0n)), false);
    assert.equal(store.claimCount, 1);
    assert.equal(store.getDrop(1n)?.claimedUnits, 1n);
  });

  it("ignores duplicate drops and closes active drops once", () => {
    const store = new Store(1n);
    assert.equal(store.addDrop(drop(1n)), true);
    assert.equal(store.addDrop(drop(1n, { price: 99n })), false);
    assert.equal(store.getDrop(1n)?.price, 10n);
    assert.equal(store.closeDrop(1n), true);
    assert.equal(store.closeDrop(1n), false);
    assert.equal(store.getDrop(1n)?.active, false);
  });

  it("pages drops newest first", () => {
    const store = new Store(1n);
    for (let id = 1n; id <= 5n; id++) store.addDrop(drop(id));

    const first = store.listDrops({ limit: 2 });
    assert.deepEqual(
      first.items.map((d) => d.id),
      [5n, 4n],
    );
    assert.equal(first.nextCursor, "4");

    const second = store.listDrops({ limit: 2, before: BigInt(first.nextCursor!) });
    assert.deepEqual(
      second.items.map((d) => d.id),
      [3n, 2n],
    );

    const last = store.listDrops({ limit: 2, before: 2n });
    assert.deepEqual(
      last.items.map((d) => d.id),
      [1n],
    );
    assert.equal(last.nextCursor, null);
  });

  it("pages a drop's claims newest first, even when applied out of order", () => {
    const store = new Store(1n);
    store.addDrop(drop(1n, { totalUnits: 10n }));
    for (const i of [2n, 0n, 3n, 1n]) store.addClaim(claim(1n, i));

    const page = store.listDropClaims(1n, { limit: 3 })!;
    assert.deepEqual(
      page.items.map((c) => c.unitIndex),
      [3n, 2n, 1n],
    );
    assert.equal(page.nextCursor, "1");
    assert.deepEqual(
      store.listDropClaims(1n, { limit: 3, before: 1n })!.items.map((c) => c.unitIndex),
      [0n],
    );
    assert.equal(store.listDropClaims(7n, { limit: 3 }), undefined);
  });

  it("pages the global claim feed newest first", () => {
    const store = new Store(1n);
    store.addDrop(drop(1n, { totalUnits: 10n }));
    store.addDrop(drop(2n, { totalUnits: 10n }));
    store.addClaim(claim(1n, 0n));
    store.addClaim(claim(2n, 0n));
    store.addClaim(claim(1n, 1n));

    const page = store.listClaims({ limit: 2 });
    assert.deepEqual(
      page.items.map((c) => [c.dropId, c.unitIndex]),
      [
        [1n, 1n],
        [2n, 0n],
      ],
    );
    const rest = store.listClaims({ limit: 2, before: Number(page.nextCursor) });
    assert.deepEqual(
      rest.items.map((c) => [c.dropId, c.unitIndex]),
      [[1n, 0n]],
    );
    assert.equal(rest.nextCursor, null);
  });

  it("round-trips through a snapshot and rejects other deployments", () => {
    const store = new Store(5n);
    store.addDrop(drop(1n));
    store.addClaim(claim(1n, 0n));
    store.closeDrop(1n);
    store.markIndexed(42n, 50n);

    const snapshot = JSON.parse(JSON.stringify(store.toSnapshot(META)));
    const restored = Store.fromSnapshot(snapshot, META)!;
    assert.equal(restored.indexedBlock, 42n);
    assert.deepEqual(restored.getDrop(1n), store.getDrop(1n));
    assert.deepEqual(
      restored.listDropClaims(1n, { limit: 10 }),
      store.listDropClaims(1n, { limit: 10 }),
    );
    assert.equal(restored.dirty, false);

    assert.equal(Store.fromSnapshot(snapshot, { ...META, chainId: 1 }), undefined);
    assert.equal(Store.fromSnapshot(snapshot, { ...META, contract: SELLER }), undefined);
  });
});
