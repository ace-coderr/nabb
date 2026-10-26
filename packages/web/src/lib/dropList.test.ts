import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Drop } from "./drop";
import {
  applyFilter,
  claimedOf,
  countByStatus,
  orderForHome,
  parseFilter,
  parseSort,
  sortItems,
  type DropListItem,
} from "./dropList";

const SELLER = "0x1111111111111111111111111111111111111111" as const;
const NOW = 1_000;

function item(
  id: number,
  overrides: Partial<Drop> = {},
  extra: Partial<DropListItem> = {},
): DropListItem {
  const drop: Drop = {
    seller: SELLER,
    maxPerWallet: 1,
    active: true,
    metadataURI: "ipfs://x",
    price: 1n,
    totalUnits: 10n,
    claimedUnits: 0n,
    startTime: 0n,
    endTime: 5_000n,
    ...overrides,
  };
  return { id: BigInt(id), drop, ...extra };
}

const live = (id: number, endTime = 5_000n, claimed = 0n) =>
  item(id, { endTime, claimedUnits: claimed });
const upcoming = (id: number) => item(id, { startTime: 2_000n });
const ended = (id: number) => item(id, { endTime: 500n });
const closed = (id: number) => item(id, { active: false });
const soldOut = (id: number) => item(id, { claimedUnits: 10n, active: false });
const ids = (list: DropListItem[]) => list.map((i) => Number(i.id));

describe("filters", () => {
  const all = [live(1), upcoming(2), ended(3), closed(4), soldOut(5), live(6)];

  it("splits drops into live, upcoming, ended (including closed) and sold out", () => {
    assert.deepEqual(ids(applyFilter(all, "live", NOW)), [1, 6]);
    assert.deepEqual(ids(applyFilter(all, "upcoming", NOW)), [2]);
    assert.deepEqual(ids(applyFilter(all, "ended", NOW)), [3, 4]);
    assert.deepEqual(ids(applyFilter(all, "soldOut", NOW)), [5]);
    assert.deepEqual(ids(applyFilter(all, "all", NOW)), [1, 2, 3, 4, 5, 6]);
  });

  it("counts match the filters and always add up to the total", () => {
    const counts = countByStatus(all, NOW);
    assert.deepEqual(counts, { all: 6, live: 2, upcoming: 1, ended: 2, soldOut: 1 });
    assert.equal(counts.live + counts.upcoming + counts.ended + counts.soldOut, counts.all);
  });

  it("trusts the contract's isLive when the local clock disagrees", () => {
    const skewed = item(7, { endTime: 500n }, { isLive: true });
    assert.equal(applyFilter([skewed], "live", NOW).length, 1);
  });

  it("handles zero drops", () => {
    assert.deepEqual(countByStatus([], NOW), {
      all: 0,
      live: 0,
      upcoming: 0,
      ended: 0,
      soldOut: 0,
    });
    assert.deepEqual(applyFilter([], "live", NOW), []);
  });
});

describe("sorting", () => {
  it("newest puts the highest id first and does not mutate its input", () => {
    const input = [live(1), live(3), live(2)];
    assert.deepEqual(ids(sortItems(input, "newest", NOW)), [3, 2, 1]);
    assert.deepEqual(ids(input), [1, 3, 2]);
  });

  it("ending soon lists live drops by end time, then everything else newest first", () => {
    const sorted = sortItems(
      [live(1, 9_000n), ended(2), live(3, 2_000n), upcoming(4), live(5, 4_000n), soldOut(6)],
      "ending",
      NOW,
    );
    assert.deepEqual(ids(sorted), [3, 5, 1, 6, 4, 2]);
  });

  it("most claimed sorts by units claimed, ties newest first", () => {
    const sorted = sortItems(
      [live(1, 5_000n, 3n), live(2, 5_000n, 9n), live(3, 5_000n, 3n)],
      "claimed",
      NOW,
    );
    assert.deepEqual(ids(sorted), [2, 3, 1]);
  });

  it("prefers the contract's remaining() over the stored counter", () => {
    assert.equal(claimedOf(item(1, { claimedUnits: 1n }, { remaining: 4n })), 6n);
    assert.equal(claimedOf(item(1, { claimedUnits: 4n })), 4n);
  });

  it("copes with 100 drops quickly and keeps every one", () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      i % 5 === 0 ? ended(i + 1) : live(i + 1, BigInt(2_000 + i), BigInt(i % 10)),
    );
    const started = performance.now();
    for (const sort of ["newest", "ending", "claimed"] as const) {
      const sorted = sortItems(many, sort, NOW);
      assert.equal(sorted.length, 100);
      assert.equal(new Set(sorted.map((i) => i.id)).size, 100);
    }
    assert.ok(performance.now() - started < 500);
  });
});

describe("orderForHome", () => {
  const items = [ended(1), live(2), live(3), upcoming(4), live(5)];

  it("defaults to the newest live drops first, then everything else newest first", () => {
    const entries = orderForHome(items, NOW, []);
    assert.deepEqual(ids(entries.map((e) => e.item)), [5, 3, 2, 4, 1]);
    assert.ok(entries.every((e) => !e.featured));
  });

  it("pins featured drops first in configured order and marks them", () => {
    const entries = orderForHome(items, NOW, [1n, 4n]);
    assert.deepEqual(ids(entries.map((e) => e.item)), [1, 4, 5, 3, 2]);
    assert.deepEqual(
      entries.map((e) => e.featured),
      [true, true, false, false, false],
    );
  });

  it("ignores unknown and repeated featured ids and never hides or duplicates a drop", () => {
    const entries = orderForHome(items, NOW, [99n, 2n, 2n]);
    assert.deepEqual(ids(entries.map((e) => e.item)), [2, 5, 3, 4, 1]);
    assert.equal(new Set(entries.map((e) => e.item.id)).size, items.length);
  });
});

describe("url params", () => {
  it("falls back to safe defaults for anything unexpected", () => {
    assert.equal(parseFilter("live"), "live");
    assert.equal(parseFilter("<script>"), "all");
    assert.equal(parseFilter(null), "all");
    assert.equal(parseSort("ending"), "ending");
    assert.equal(parseSort("oldest"), "newest");
    assert.equal(parseSort(undefined), "newest");
  });
});
