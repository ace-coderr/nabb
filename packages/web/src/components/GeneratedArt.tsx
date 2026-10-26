import { useId, useMemo, type ReactNode } from "react";
import {
  artFamily,
  artPalette,
  artSeed,
  createRandom,
  type ArtFamily,
  type ArtPalette,
} from "../lib/art";

/**
 * Original abstract artwork for a drop, generated from its id. Eight motif families (peaks, rings,
 * burst, waves, grid, orbit, stripes, topo) in six warm palettes; the family follows the id so
 * neighbouring drops always look different. The same id always yields the same picture.
 */

const SIZE = 400;
const SHADE = "#0c0705";

type Rng = () => number;

interface Tone {
  bgA: string;
  bgB: string;
  main: string;
  light: string;
  deep: string;
  hue: number;
}

const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;

function toneFor(palette: ArtPalette): Tone {
  const h = palette.hue;
  return {
    hue: h,
    bgA: hsl(h, 55, 10),
    bgB: hsl(h + 12, 62, 24),
    main: hsl(h, 92, 58),
    light: hsl(h + 16, 100, 76),
    deep: hsl(h - 8, 72, 34),
  };
}

const between = (r: Rng, min: number, max: number) => min + r() * (max - min);
const f = (n: number) => Math.round(n * 10) / 10;

interface FamilyProps {
  r: Rng;
  t: Tone;
  uid: string;
}

function Peaks({ r, t, uid }: FamilyProps) {
  const sunX = between(r, 110, 290);
  const sunY = between(r, 90, 150);
  const layers = Array.from({ length: 4 }, (_, i) => {
    const base = 190 + i * 45;
    const points: string[] = [`-20,${SIZE + 20}`];
    for (let x = -20; x <= SIZE + 20; x += between(r, 50, 90)) {
      points.push(`${f(x)},${f(base - between(r, 20, 90) + (i % 2) * 14)}`);
    }
    points.push(`${SIZE + 20},${SIZE + 20}`);
    return {
      points: points.join(" "),
      fill: hsl(t.hue + i * 4, 70 - i * 6, 52 - i * 12, 0.55 + i * 0.12),
    };
  });
  return (
    <>
      <circle cx={sunX} cy={sunY} r="120" fill={`url(#${uid}-glow)`} />
      <circle cx={sunX} cy={sunY} r={between(r, 34, 54)} fill={t.light} />
      {layers.map((l, i) => (
        <polygon key={i} points={l.points} fill={l.fill} />
      ))}
    </>
  );
}

function Rings({ r, t, uid }: FamilyProps) {
  const cx = between(r, 150, 250);
  const cy = between(r, 150, 250);
  const count = 9 + Math.floor(r() * 4);
  return (
    <>
      <circle cx={cx} cy={cy} r="170" fill={`url(#${uid}-glow)`} />
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={cx + i * 3}
          cy={cy - i * 2}
          r={20 + i * 26}
          fill="none"
          stroke={i % 3 === 0 ? t.light : t.main}
          strokeOpacity={0.9 - i * 0.07}
          strokeWidth={i % 4 === 0 ? 7 : 2.5}
        />
      ))}
      <circle cx={cx} cy={cy} r={between(r, 22, 34)} fill={t.main} />
    </>
  );
}

function Burst({ r, t, uid }: FamilyProps) {
  const cx = between(r, 170, 230);
  const cy = between(r, 170, 230);
  const rays = 24 + Math.floor(r() * 3) * 4;
  const phase = r() * Math.PI;
  return (
    <>
      <circle cx={cx} cy={cy} r="200" fill={`url(#${uid}-glow)`} />
      {Array.from({ length: rays }, (_, i) => {
        const a0 = phase + (i / rays) * Math.PI * 2;
        const a1 = phase + ((i + 0.5) / rays) * Math.PI * 2;
        const long = i % 2 === 0 ? 330 : 190;
        const x0 = cx + Math.cos(a0) * long;
        const y0 = cy + Math.sin(a0) * long;
        const x1 = cx + Math.cos(a1) * long;
        const y1 = cy + Math.sin(a1) * long;
        return (
          <polygon
            key={i}
            points={`${f(cx)},${f(cy)} ${f(x0)},${f(y0)} ${f(x1)},${f(y1)}`}
            fill={i % 2 === 0 ? t.main : t.light}
            fillOpacity={i % 2 === 0 ? 0.55 : 0.3}
          />
        );
      })}
      <circle cx={cx} cy={cy} r="46" fill={t.deep} />
      <circle cx={cx} cy={cy} r="26" fill={t.light} />
    </>
  );
}

function Waves({ r, t, uid }: FamilyProps) {
  const bands = Array.from({ length: 7 }, (_, i) => {
    const base = 120 + i * 42;
    const amp = between(r, 10, 26);
    const freq = between(r, 0.012, 0.03);
    const phase = r() * 6;
    let d = `M-10,${SIZE + 10} L-10,${f(base)}`;
    for (let x = -10; x <= SIZE + 10; x += 10) {
      d += ` L${x},${f(base + Math.sin(x * freq + phase) * amp)}`;
    }
    d += ` L${SIZE + 10},${SIZE + 10} Z`;
    return { d, fill: hsl(t.hue + i * 3, 80 - i * 4, 58 - i * 6, 0.5 + i * 0.07) };
  });
  return (
    <>
      <circle cx={between(r, 90, 310)} cy={90} r="110" fill={`url(#${uid}-glow)`} />
      <circle cx={between(r, 90, 310)} cy={96} r={between(r, 26, 40)} fill={t.light} />
      {bands.map((b, i) => (
        <path key={i} d={b.d} fill={b.fill} />
      ))}
    </>
  );
}

function Grid({ r, t, uid }: FamilyProps) {
  const cell = 40;
  const cells: ReactNode[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const v = r();
      if (v < 0.28) continue;
      const hot = v > 0.93;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={col * cell + 5}
          y={row * cell + 5}
          width={cell - 10}
          height={cell - 10}
          rx={v > 0.7 ? 14 : 4}
          fill={hot ? t.light : v > 0.6 ? t.main : t.deep}
          fillOpacity={hot ? 1 : 0.25 + v * 0.5}
        />,
      );
    }
  }
  return (
    <>
      <circle
        cx={between(r, 120, 280)}
        cy={between(r, 120, 280)}
        r="180"
        fill={`url(#${uid}-glow)`}
      />
      {cells}
    </>
  );
}

function Orbit({ r, t, uid }: FamilyProps) {
  const cx = 200;
  const cy = 200;
  const orbits = Array.from({ length: 4 }, (_, i) => ({
    rx: 70 + i * 38 + between(r, 0, 14),
    ry: 26 + i * 18 + between(r, 0, 10),
    rot: between(r, -60, 60),
    dot: r() * Math.PI * 2,
  }));
  return (
    <>
      <circle cx={cx} cy={cy} r="190" fill={`url(#${uid}-glow)`} />
      {orbits.map((o, i) => {
        const dx = Math.cos(o.dot) * o.rx;
        const dy = Math.sin(o.dot) * o.ry;
        return (
          <g key={i} transform={`rotate(${f(o.rot)} ${cx} ${cy})`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={o.rx}
              ry={o.ry}
              fill="none"
              stroke={i % 2 ? t.main : t.light}
              strokeOpacity="0.7"
              strokeWidth="2.5"
            />
            <circle cx={cx + dx} cy={cy + dy} r={6 + i * 2} fill={t.light} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="42" fill={t.main} />
      <circle cx={cx - 10} cy={cy - 10} r="14" fill={t.light} fillOpacity="0.8" />
    </>
  );
}

function Stripes({ r, t, uid }: FamilyProps) {
  const rot = between(r, -42, -28);
  const bands: { y: number; h: number; fill: string }[] = [];
  let y = -260;
  for (let i = 0; y < 640; i++) {
    const h = between(r, 16, 62);
    bands.push({ y, h, fill: i % 2 ? t.main : t.deep });
    y += h + between(r, 8, 30);
  }
  const sx = between(r, 130, 270);
  return (
    <>
      <g transform={`rotate(${f(rot)} 200 200)`} opacity="0.72">
        {bands.map((b, i) => (
          <rect key={i} x="-300" y={f(b.y)} width="1000" height={f(b.h)} fill={b.fill} />
        ))}
      </g>
      <circle cx={sx} cy="150" r="96" fill={`url(#${uid}-glow)`} />
      <circle cx={sx} cy="150" r={between(r, 44, 62)} fill={t.light} />
    </>
  );
}

function Topo({ r, t, uid }: FamilyProps) {
  const cx = between(r, 150, 250);
  const cy = between(r, 150, 250);
  const p1 = r() * 6;
  const p2 = r() * 6;
  const k1 = 2 + Math.floor(r() * 3);
  const k2 = 4 + Math.floor(r() * 3);
  const rings = Array.from({ length: 13 }, (_, i) => {
    const base = 18 + i * 19;
    let d = "";
    for (let s = 0; s <= 64; s++) {
      const a = (s / 64) * Math.PI * 2;
      const rad = base * (1 + 0.12 * Math.sin(k1 * a + p1) + 0.06 * Math.sin(k2 * a + p2));
      d += `${s === 0 ? "M" : "L"}${f(cx + Math.cos(a) * rad)},${f(cy + Math.sin(a) * rad)}`;
    }
    return d + "Z";
  });
  return (
    <>
      <circle cx={cx} cy={cy} r="180" fill={`url(#${uid}-glow)`} />
      {rings.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={i === 0 ? t.main : "none"}
          fillOpacity="0.85"
          stroke={i % 4 === 0 ? t.light : t.main}
          strokeOpacity={0.85 - i * 0.04}
          strokeWidth={i % 4 === 0 ? 3.5 : 1.8}
        />
      ))}
    </>
  );
}

const FAMILIES: Record<ArtFamily, (props: FamilyProps) => ReactNode> = {
  peaks: Peaks,
  rings: Rings,
  burst: Burst,
  waves: Waves,
  grid: Grid,
  orbit: Orbit,
  stripes: Stripes,
  topo: Topo,
};

export function GeneratedArt({ seed, className }: { seed: bigint; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const family = artFamily(seed);
  const palette = artPalette(seed);
  const tone = useMemo(() => toneFor(palette), [palette]);
  const angle = useMemo(() => Math.floor(createRandom(artSeed(seed) ^ 0x9e3779b9)() * 360), [seed]);
  const Family = FAMILIES[family];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-art-family={family}
    >
      <defs>
        <linearGradient
          id={`${uid}-bg`}
          gradientTransform={`rotate(${angle} 0.5 0.5)`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor={tone.bgA} />
          <stop offset="1" stopColor={tone.bgB} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={tone.main} stopOpacity="0.55" />
          <stop offset="1" stopColor={tone.main} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor={SHADE} stopOpacity="0" />
          <stop offset="1" stopColor={SHADE} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect width={SIZE} height={SIZE} fill={`url(#${uid}-bg)`} />
      {/* A fresh generator per render keeps the output a pure function of the drop id. */}
      <Family r={createRandom(artSeed(seed))} t={tone} uid={uid} />
      <rect width={SIZE} height={SIZE} fill={`url(#${uid}-shade)`} />
    </svg>
  );
}
