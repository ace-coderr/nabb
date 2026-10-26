import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAgo, formatDuration, formatEth, formatPrice, shortAddress } from "./format";

describe("formatEth / formatPrice", () => {
  it("trims trailing zeros and never shows scientific notation", () => {
    assert.equal(formatEth(0n), "0");
    assert.equal(formatEth(1_500_000_000_000_000_000n), "1.5");
    assert.equal(formatEth(10_000_000_000_000n), "0.00001");
    assert.equal(formatEth(10n ** 30n), "1000000000000");
  });

  it("rounds dust below the display precision down to 0 instead of lying", () => {
    assert.equal(formatEth(1n), "0");
    assert.equal(formatEth(999_999_999n), "0");
  });

  it("labels zero as Free", () => {
    assert.equal(formatPrice(0n), "Free");
    assert.equal(formatPrice(10n ** 18n), "1 ETH");
  });
});

describe("formatDuration", () => {
  it("picks the two most useful units and clamps negatives", () => {
    assert.equal(formatDuration(-5), "0s");
    assert.equal(formatDuration(9), "9s");
    assert.equal(formatDuration(65), "1m 05s");
    assert.equal(formatDuration(3_600), "1h 0m");
    assert.equal(formatDuration(90_000), "1d 1h");
  });
});

describe("formatAgo / shortAddress", () => {
  it("buckets relative times", () => {
    assert.equal(formatAgo(100, 102), "just now");
    assert.equal(formatAgo(100, 130), "30s ago");
    assert.equal(formatAgo(100, 100 + 180), "3m ago");
    assert.equal(formatAgo(100, 100 + 7_200), "2h ago");
    assert.equal(formatAgo(100, 100 + 172_800), "2d ago");
    // A claim timestamped slightly in the future (clock skew) never shows a negative age.
    assert.equal(formatAgo(200, 100), "just now");
  });

  it("shortens addresses", () => {
    assert.equal(shortAddress("0x8557FABdC62f59A1bA7D6a74aaf0942CDcb68F69"), "0x8557…8F69");
  });
});
