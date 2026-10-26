import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Drop } from "./drop";
import { dropPhase, parseDropId, reconciledPhase } from "./drop";

const SELLER = "0x1111111111111111111111111111111111111111" as const;

function drop(overrides: Partial<Drop> = {}): Drop {
  return {
    seller: SELLER,
    maxPerWallet: 1,
    active: true,
    metadataURI: "ipfs://x",
    price: 1n,
    totalUnits: 10n,
    claimedUnits: 0n,
    startTime: 1_000n,
    endTime: 2_000n,
    ...overrides,
  };
}

describe("parseDropId", () => {
  it("accepts positive integers", () => {
    assert.equal(parseDropId("1"), 1n);
    assert.equal(parseDropId("42"), 42n);
    assert.equal(parseDropId("9".repeat(30)), BigInt("9".repeat(30)));
  });

  it("rejects zero, negatives, decimals, exponents, hex, junk and absurd lengths", () => {
    for (const bad of [
      "0",
      "-1",
      "1.5",
      "1e3",
      "0x10",
      "abc",
      "",
      " 1",
      "1 ",
      "1;2",
      "9".repeat(31),
    ]) {
      assert.equal(parseDropId(bad), undefined, JSON.stringify(bad));
    }
    assert.equal(parseDropId(undefined), undefined);
  });
});

describe("dropPhase", () => {
  it("is upcoming before the start and live from the start through the end, inclusive", () => {
    assert.equal(dropPhase(drop(), 999), "upcoming");
    assert.equal(dropPhase(drop(), 1_000), "live");
    assert.equal(dropPhase(drop(), 2_000), "live");
    assert.equal(dropPhase(drop(), 2_001), "ended");
  });

  it("reports sold out ahead of closed, and closed ahead of the time window", () => {
    assert.equal(dropPhase(drop({ claimedUnits: 10n, active: false }), 1_500), "soldOut");
    assert.equal(dropPhase(drop({ active: false }), 1_500), "closed");
    assert.equal(dropPhase(drop({ active: false }), 5_000), "closed");
  });
});

describe("reconciledPhase", () => {
  it("trusts the contract when the local clock disagrees", () => {
    // Local clock says ended, chain says live (device clock is ahead).
    assert.equal(reconciledPhase(drop(), 9_999, true), "live");
    // Local clock says live, chain says not live (device clock is behind the window's end).
    assert.equal(reconciledPhase(drop(), 1_900, false), "ended");
    assert.equal(reconciledPhase(drop(), 1_100, false), "upcoming");
  });

  it("uses the local view when the contract has not answered", () => {
    assert.equal(reconciledPhase(drop(), 1_500), "live");
    assert.equal(reconciledPhase(drop(), 1_500, undefined), "live");
  });

  it("agrees with the local view when both match", () => {
    assert.equal(reconciledPhase(drop(), 1_500, true), "live");
    assert.equal(reconciledPhase(drop({ active: false }), 1_500, false), "closed");
  });
});
