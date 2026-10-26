/**
 * Selection logic for drop artwork. Pure and deterministic, so it can be tested without rendering.
 *
 * Every drop id maps to one of eight motif families and one of six warm palettes. The family is
 * `FAMILY_ORDER[id mod 8]`, which is a bijection over any run of eight consecutive ids, so two
 * adjacent drops can never share a family.
 */

export const FAMILY_ORDER = [
  "peaks",
  "rings",
  "burst",
  "waves",
  "grid",
  "orbit",
  "stripes",
  "topo",
] as const;

export type ArtFamily = (typeof FAMILY_ORDER)[number];

/** Warm palettes only: the cool speed accent is reserved for measured numbers. */
export const PALETTES = [
  { name: "ember", hue: 18 },
  { name: "amber", hue: 38 },
  { name: "crimson", hue: 352 },
  { name: "terracotta", hue: 8 },
  { name: "saffron", hue: 46 },
  { name: "rose", hue: 336 },
] as const;

export type ArtPalette = (typeof PALETTES)[number];

const positiveMod = (value: bigint, modulus: bigint) => ((value % modulus) + modulus) % modulus;

export function artFamily(id: bigint): ArtFamily {
  return FAMILY_ORDER[Number(positiveMod(id, BigInt(FAMILY_ORDER.length)))]!;
}

export function artPalette(id: bigint): ArtPalette {
  // Mixing in the higher bits means a family does not always come back in the same palette.
  const index = positiveMod(id * 5n + (id >> 3n), BigInt(PALETTES.length));
  return PALETTES[Number(index)]!;
}

/** A 32-bit seed for the generator's random numbers, stable for a given id. */
export function artSeed(id: bigint): number {
  return Number(BigInt.asUintN(32, id * 2654435761n + 40503n));
}

/** Small, fast seeded generator (mulberry32). */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
