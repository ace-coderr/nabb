import { explorerTxUrl } from "@nabb/config";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useClaim, type ClaimCallbacks, type ClaimState } from "../hooks/useClaim";
import { useEnsureChain } from "../hooks/useEnsureChain";
import type { Drop, DropPhase } from "../lib/drop";
import { formatDuration, formatPrice } from "../lib/format";
import { ConnectButton } from "./ConnectButton";

interface Props extends ClaimCallbacks {
  dropId: bigint;
  drop: Drop;
  phase: DropPhase;
  walletClaims: bigint;
  now: number;
}

export function NabButton({ dropId, drop, phase, walletClaims, now, ...callbacks }: Props) {
  const { isConnected } = useAccount();
  const { wrongChain, ensureChain, switching } = useEnsureChain();
  const { state, claim } = useClaim(callbacks);

  if (!isConnected) return <ConnectButton size="lg" />;

  if (wrongChain) {
    return (
      <button
        className="btn btn-warn btn-lg btn-block"
        onClick={() => void ensureChain()}
        disabled={switching}
      >
        {switching ? "Switching…" : "Switch to GIWA Sepolia"}
      </button>
    );
  }

  const busy = state.status === "confirming" || state.status === "pending";
  const limitReached = walletClaims >= BigInt(drop.maxPerWallet);

  let label: React.ReactNode = `Nab it · ${formatPrice(drop.price)}`;
  let disabled = busy;
  if (state.status === "confirming") label = "Confirm in wallet…";
  else if (state.status === "pending") label = <Ticker since={state.sentAt} />;
  else if (phase === "upcoming") {
    label = `Opens in ${formatDuration(Number(drop.startTime) - now)}`;
    disabled = true;
  } else if (phase === "soldOut") {
    label = "Sold out";
    disabled = true;
  } else if (phase === "ended") {
    label = "Drop ended";
    disabled = true;
  } else if (phase === "closed") {
    label = "Drop closed";
    disabled = true;
  } else if (limitReached) {
    label = "Wallet limit reached";
    disabled = true;
  }

  return (
    <div className="nab">
      <button
        className={`btn btn-nab btn-block ${busy ? "is-busy" : ""}`}
        onClick={() => void claim(dropId, drop.price)}
        disabled={disabled}
      >
        {label}
      </button>
      <ClaimResult state={state} />
    </div>
  );
}

/** Live millisecond counter while waiting for the first receipt. */
function Ticker({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let frame = requestAnimationFrame(function update() {
      setElapsed(performance.now() - since);
      frame = requestAnimationFrame(update);
    });
    return () => cancelAnimationFrame(frame);
  }, [since]);
  return (
    <span className="mono">
      Nabbing… <span className="ticker">{Math.round(elapsed)}ms</span>
    </span>
  );
}

function formatMs(ms: number): string {
  return ms < 1_000 ? `${Math.round(ms)}ms` : `${(ms / 1_000).toFixed(2)}s`;
}

function ClaimResult({ state }: { state: ClaimState }) {
  if (state.status === "nabbed") {
    const unit = state.unitIndex !== undefined ? `Unit #${(state.unitIndex + 1n).toString()}` : "";
    return (
      <div className="nab-result nab-success" role="status">
        <div className="nab-latency">
          Nabbed in <span className="mono">{formatMs(state.latencyMs)}</span>
          {state.via === "flashblocks" && " ⚡"}
        </div>
        <div className="nab-detail">
          <span>
            {unit}
            {unit && " · "}
            {state.via === "flashblocks"
              ? "preconfirmed via Flashblocks"
              : "confirmed by the standard RPC"}
          </span>
          <span className="nab-final">
            {state.final ? (
              <>
                Final in block {state.final.blockNumber.toString()} · {formatMs(state.final.ms)}
              </>
            ) : (
              <>
                <span className="spinner" /> Waiting for the sealed block…
              </>
            )}
          </span>
          <a href={explorerTxUrl(state.hash)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="nab-result nab-error" role="alert">
        <div>{state.message}</div>
        {state.hash && (
          <a href={explorerTxUrl(state.hash)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
      </div>
    );
  }
  return null;
}
