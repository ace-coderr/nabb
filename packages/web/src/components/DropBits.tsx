import { useState } from "react";
import { PHASE_LABEL, type DropPhase } from "../lib/drop";
import { GeneratedArt } from "./GeneratedArt";

/** The drop's own image, or original generated artwork seeded by its id. */
export function DropArt({ image, name, seed }: { image?: string; name: string; seed: bigint }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return <img className="drop-art" src={image} alt={name} onError={() => setFailed(true)} />;
  }
  return (
    <div className="drop-art drop-art-generated">
      <GeneratedArt seed={seed} className="drop-art-svg" />
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
      aria-label="Claimed"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
