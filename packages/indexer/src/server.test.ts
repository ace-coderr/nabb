import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { IndexedClaim, IndexedDrop, IndexerHealth, IndexerPage } from "@nabb/config";
import type { Address, Hash } from "viem";
import { buildServer } from "./server";
import { Store } from "./store";

const META = { chainId: 91342, contract: "0x3333333333333333333333333333333333333333" as Address };
const SELLER = "0x1111111111111111111111111111111111111111" as Address;
const ALICE = "0x2222222222222222222222222222222222222222" as Address;

function seed(): Store {
  const store = new Store(100n);
  for (let id = 1n; id <= 3n; id++) {
    store.addDrop({
      id,
      seller: SELLER,
      metadataURI: `ipfs://drop-${id}`,
      price: 10n ** 18n,
      totalUnits: 5n,
      claimedUnits: 0n,
      startTime: 0n,
      endTime: 2n ** 63n,
      maxPerWallet: 2,
      active: true,
      createdAt: 1_700_000_000,
      createdBlock: 100n + id,
      createdTx: `0x${"a".repeat(64)}` as Hash,
    });
  }
  for (let i = 0n; i < 3n; i++) {
    const txHash = `0x${i.toString().repeat(64)}` as Hash;
    store.addClaim({
      id: `${txHash}:0`,
      dropId: 2n,
      claimer: ALICE,
      unitIndex: i,
      pricePaid: 10n ** 18n,
      timestamp: 1_700_000_100 + Number(i),
      blockNumber: 200n + i,
      txHash,
      logIndex: 0,
    });
  }
  store.markIndexed(250n, 252n);
  return store;
}

describe("REST server", () => {
  const app = buildServer(seed(), { meta: META, corsOrigin: true });
  before(() => app.ready());
  after(() => app.close());

  it("reports health and lag", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json<IndexerHealth>();
    assert.equal(body.ok, true);
    assert.equal(body.indexedBlock, "250");
    assert.equal(body.lagBlocks, "2");
    assert.equal(body.drops, 3);
    assert.equal(body.claims, 3);
    assert.equal(res.headers["cache-control"], "no-store");
  });

  it("lists drops newest first with string-encoded integers", async () => {
    const res = await app.inject({ method: "GET", url: "/drops?limit=2" });
    const body = res.json<IndexerPage<IndexedDrop>>();
    assert.deepEqual(
      body.items.map((d) => d.id),
      ["3", "2"],
    );
    assert.equal(body.items[0]!.price, "1000000000000000000");
    assert.equal(body.items[0]!.endTime, (2n ** 63n).toString());
    assert.equal(body.nextCursor, "2");

    const next = await app.inject({
      method: "GET",
      url: `/drops?limit=2&before=${body.nextCursor}`,
    });
    assert.deepEqual(
      next.json<IndexerPage<IndexedDrop>>().items.map((d) => d.id),
      ["1"],
    );
  });

  it("returns one drop with its derived counters, or 404", async () => {
    const res = await app.inject({ method: "GET", url: "/drops/2" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<IndexedDrop>().claimedUnits, "3");

    const missing = await app.inject({ method: "GET", url: "/drops/99" });
    assert.equal(missing.statusCode, 404);
  });

  it("lists a drop's claims newest first, or 404 for unknown drops", async () => {
    const res = await app.inject({ method: "GET", url: "/drops/2/claims?limit=2" });
    const body = res.json<IndexerPage<IndexedClaim>>();
    assert.deepEqual(
      body.items.map((c) => c.unitIndex),
      ["2", "1"],
    );
    assert.match(body.items[0]!.id, /^0x[0-9a-f]{64}:0$/);
    assert.equal(body.nextCursor, "1");

    const missing = await app.inject({ method: "GET", url: "/drops/99/claims" });
    assert.equal(missing.statusCode, 404);
  });

  it("serves the global claim feed", async () => {
    const res = await app.inject({ method: "GET", url: "/claims?limit=10" });
    const body = res.json<IndexerPage<IndexedClaim>>();
    assert.equal(body.items.length, 3);
    assert.equal(body.items[0]!.unitIndex, "2");
    assert.equal(body.nextCursor, null);
  });

  it("rejects malformed input", async () => {
    for (const url of ["/drops?limit=0", "/drops?limit=101", "/drops?before=-1", "/drops/abc"]) {
      const res = await app.inject({ method: "GET", url });
      assert.equal(res.statusCode, 400, url);
    }
  });

  it("sends CORS headers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/drops",
      headers: { origin: "http://localhost:5173" },
    });
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  });
});
