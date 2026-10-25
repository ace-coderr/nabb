import { useState } from "react";
import { PHASE_LABEL, type DropPhase } from "../lib/drop";

/** Drop image, or a deterministic gradient tile when there is none (or it fails to load). */
export function DropArt({ image, name, seed }: { image?: string; name: string; seed: bigint }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return <img className="drop-art" src={image} alt={name} onError={() => setFailed(true)} />;
  }
  const hue = Number((seed * 47n) % 360n);
  return (
    <div
      className="drop-art drop-art-fallback"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 90% 60%), hsl(${(hue + 60) % 360} 85% 45%))`,
      }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "N"}
    </div>
  );
}

export function PhaseBadge({ phase }: { phase: DropPhase }) {
  return (
    <span className={`badge badge-${phase}`}>
      {phase === "live" && <span className="pulse" />}
      {PHASE_LABEL[phase]}
    </span>
  );
}

export function ProgressBar({ claimed, total }: { claimed: bigint; total: bigint }) {
  const pct = total > 0n ? Number((claimed * 10_000n) / total) / 100 : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
