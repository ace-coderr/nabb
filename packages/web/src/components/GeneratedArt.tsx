import { useId, useMemo } from "react";

/**
 * Original abstract artwork for a drop, generated from its id: warm gradients, soft glows, slabs,
 * rings, dot grids and one or two bolts. The same id always yields the same picture. The cool
 * speed accent is deliberately never used here.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WARM_HUES = [4, 12, 20, 28, 36, 46, 352];

/** Unit bolt, roughly spanning -1..1 on both axes. */
const BOLT = "M0.15 -1 L-0.62 0.14 L-0.1 0.14 L-0.32 1 L0.66 -0.26 L0.1 -0.26 Z";

interface Spec {
  h1: number;
  h2: number;
  angle: number;
  blobs: { x: number; y: number; r: number; hue: number; o: number }[];
  bands: { rot: number; offset: number; w: number; o: number }[];
  ring: { x: number; y: number; r: number; dash: boolean };
  dots: { x: number; y: number; step: number };
  bolts: { x: number; y: number; s: number; rot: number; o: number }[];
}

function build(seed: bigint): Spec {
  const r = mulberry32(Number(BigInt.asUintN(32, seed * 2654435761n + 40503n)));
  const between = (min: number, max: number) => min + r() * (max - min);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)]!;

  const h1 = pick(WARM_HUES);
  const h2 = (h1 + between(14, 34) + 360) % 360;
  const blobs = Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({
    x: between(40, 360),
    y: between(40, 360),
    r: between(90, 190),
    hue: pick(WARM_HUES),
    o: between(0.35, 0.8),
  }));
  const bands = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({
    rot: between(-50, 50),
    offset: between(-120, 520),
    w: between(24, 80),
    o: between(0.07, 0.18),
  }));
  const bolts = [
    {
      x: between(170, 230),
      y: between(180, 220),
      s: between(105, 150),
      rot: between(-26, 26),
      o: 1,
    },
  ];
  if (r() > 0.45) {
    bolts.push({
      x: pick([between(40, 100), between(300, 360)]),
      y: pick([between(50, 110), between(290, 350)]),
      s: between(34, 62),
      rot: between(-40, 40),
      o: 0.55,
    });
  }
  return {
    h1,
    h2,
    angle: Math.floor(r() * 360),
    blobs,
    bands,
    ring: { x: between(80, 320), y: between(80, 320), r: between(55, 125), dash: r() > 0.5 },
    dots: { x: pick([24, 270]), y: pick([24, 270]), step: between(14, 20) },
    bolts,
  };
}

export function GeneratedArt({ seed, className }: { seed: bigint; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const spec = useMemo(() => build(seed), [seed]);
  const { h1, h2 } = spec;
  const id = (name: string) => `${uid}-${name}`;

  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={id("bg")}
          gradientTransform={`rotate(${spec.angle} 0.5 0.5)`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor={`hsl(${h1} 52% 13%)`} />
          <stop offset="1" stopColor={`hsl(${h2} 62% 27%)`} />
        </linearGradient>
        <linearGradient id={id("bolt")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={`hsl(${(h1 + 18) % 360} 100% 74%)`} />
          <stop offset="1" stopColor={`hsl(${h1} 96% 55%)`} />
        </linearGradient>
        <linearGradient id={id("shade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#0c0705" stopOpacity="0" />
          <stop offset="1" stopColor="#0c0705" stopOpacity="0.55" />
        </linearGradient>
        {spec.blobs.map((b, i) => (
          <radialGradient key={i} id={id(`blob${i}`)}>
            <stop offset="0" stopColor={`hsl(${b.hue} 92% 56%)`} stopOpacity={b.o} />
            <stop offset="1" stopColor={`hsl(${b.hue} 92% 56%)`} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      <rect width="400" height="400" fill={`url(#${id("bg")})`} />

      {spec.blobs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#${id(`blob${i}`)})`} />
      ))}

      {spec.bands.map((b, i) => (
        <rect
          key={i}
          x={-200}
          y={b.offset}
          width={800}
          height={b.w}
          fill={`hsl(${h2} 90% 66%)`}
          opacity={b.o}
          transform={`rotate(${b.rot} 200 200)`}
        />
      ))}

      <circle
        cx={spec.ring.x}
        cy={spec.ring.y}
        r={spec.ring.r}
        fill="none"
        stroke={`hsl(${h1} 95% 72%)`}
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray={spec.ring.dash ? "3 9" : undefined}
      />

      {Array.from({ length: 25 }, (_, i) => (
        <circle
          key={i}
          cx={spec.dots.x + (i % 5) * spec.dots.step}
          cy={spec.dots.y + Math.floor(i / 5) * spec.dots.step}
          r="1.8"
          fill={`hsl(${h1} 90% 78%)`}
          opacity="0.4"
        />
      ))}

      {spec.bolts.map((b, i) => (
        <g
          key={i}
          opacity={b.o}
          transform={`translate(${b.x} ${b.y}) rotate(${b.rot}) scale(${b.s})`}
        >
          <path d={BOLT} transform="translate(0.09 0.11)" fill="#0c0705" opacity="0.32" />
          <path d={BOLT} fill={`url(#${id("bolt")})`} />
        </g>
      ))}

      <rect width="400" height="400" fill={`url(#${id("shade")})`} />
    </svg>
  );
}
