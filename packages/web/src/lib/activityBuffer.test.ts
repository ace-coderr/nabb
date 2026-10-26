import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Hash } from "viem";
import { MAX_ITEMS, activityFromClaim, mergeActivity, type ActivityItem } from "./activityBuffer";

const CLAIMER = "0x2222222222222222222222222222222222222222" as Address;

function item(id: string, timestamp: number, extra: Partial<ActivityItem> = {}): ActivityItem {
  return { id, dropId: 1n, timestamp, ...extra };
}

describe("mergeActivity", () => {
  it("sorts newest first", () => {
    const merged = mergeActivity([item("a", 10), item("b", 30)], [item("c", 20)]);
    assert.deepEqual(
      merged.map((i) => i.id),
      ["b", "c", "a"],
    );
  });

  it("drops duplicates, letting the earlier list win", () => {
    const live = item("a", 10, { count: 1 });
    const seeded = item("a", 10, { count: 99 });
    const merged = mergeActivity([live], [seeded, item("b", 5)]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((i) => i.id === "a")?.count, 1);
  });

  it("caps the buffer, keeping the newest entries", () => {
    const many = Array.from({ length: MAX_ITEMS + 15 }, (_, i) => item(`i${i}`, i));
    const merged = mergeActivity(many);
    assert.equal(merged.length, MAX_ITEMS);
    assert.equal(merged[0]!.id, `i${MAX_ITEMS + 14}`);
  });

  it("handles empty input", () => {
    assert.deepEqual(mergeActivity(), []);
    assert.deepEqual(mergeActivity([], []), []);
  });
});

describe("activityFromClaim", () => {
  it("keeps the shared txHash:logIndex id so feeds and seeds de-duplicate", () => {
    const txHash = `0x${"ab".repeat(32)}` as Hash;
    const a = activityFromClaim({
      id: `${txHash}:3`,
      dropId: 2n,
      claimer: CLAIMER,
      unitIndex: 4n,
      pricePaid: 10n,
      timestamp: 99,
      txHash,
      logIndex: 3,
      blockNumber: 7n,
    });
    assert.equal(a.id, `${txHash}:3`);
    assert.equal(a.unitIndex, 4n);
    assert.deepEqual(mergeActivity([a], [{ ...a }]).length, 1);
  });
});
