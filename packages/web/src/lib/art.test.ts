import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAMILY_ORDER, PALETTES, artFamily, artPalette, artSeed, createRandom } from "./art";

describe("artFamily", () => {
  it("never gives two adjacent drop ids the same family", () => {
    for (let id = 0n; id < 5_000n; id++) {
      assert.notEqual(artFamily(id), artFamily(id + 1n), `ids ${id} and ${id + 1n}`);
    }
  });

  it("uses all eight families across any eight consecutive ids", () => {
    for (const start of [0n, 1n, 7n, 1_000n, 123_456_789_012_345_678_901n]) {
      const seen = new Set(Array.from({ length: 8 }, (_, i) => artFamily(start + BigInt(i))));
      assert.equal(seen.size, FAMILY_ORDER.length);
    }
  });

  it("is deterministic and handles huge and negative ids without throwing", () => {
    assert.equal(artFamily(42n), artFamily(42n));
    assert.ok(FAMILY_ORDER.includes(artFamily(2n ** 255n)));
    assert.ok(FAMILY_ORDER.includes(artFamily(-5n)));
  });
});

describe("artPalette", () => {
  it("always returns one of the warm palettes and covers all of them", () => {
    const seen = new Set<string>();
    for (let id = 1n; id <= 200n; id++) {
      const palette = artPalette(id);
      assert.ok(PALETTES.includes(palette));
      seen.add(palette.name);
    }
    assert.equal(seen.size, PALETTES.length);
  });

  it("only uses hues in the warm range (reds, oranges, yellows)", () => {
    for (const { hue } of PALETTES) {
      assert.ok(hue >= 330 || hue <= 60, `hue ${hue}`);
    }
  });

  it("varies the palette within a family", () => {
    const byFamily = new Map<string, Set<string>>();
    for (let id = 1n; id <= 400n; id++) {
      const family = artFamily(id);
      byFamily.set(family, (byFamily.get(family) ?? new Set()).add(artPalette(id).name));
    }
    for (const [family, palettes] of byFamily) {
      assert.ok(palettes.size >= 3, `${family} only used ${palettes.size} palette(s)`);
    }
  });
});

describe("createRandom", () => {
  it("is repeatable for a seed and stays within [0, 1)", () => {
    const a = createRandom(artSeed(7n));
    const b = createRandom(artSeed(7n));
    for (let i = 0; i < 100; i++) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
  });

  it("gives different sequences for different ids", () => {
    assert.notEqual(createRandom(artSeed(1n))(), createRandom(artSeed(2n))());
  });
});
