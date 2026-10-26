import { explorerTxUrl } from "@nabb/config";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useClaim, type ClaimCallbacks, type ClaimState } from "../hooks/useClaim";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { useWalletBalance } from "../hooks/useWalletBalance";
import type { Drop, DropPhase } from "../lib/drop";
import { formatDuration, formatPrice } from "../lib/format";
import { ConnectButton } from "./ConnectButton";
import { FaucetHint } from "./FaucetHint";

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
  const { canAfford } = useWalletBalance();

  // The broadcast time is only in the `pending` state; keep it for the race bars that continue
  // after the claim has been preconfirmed.
  const [sentAt, setSentAt] = useState<number>();
  if (state.status === "pending" && state.sentAt !== sentAt) setSentAt(state.sentAt);

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
  else if (state.status === "pending") label = "Nabbing…";
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
  // Only worth flagging when funds are the one thing standing between the user and a claim.
  const needsFunds = !disabled && !canAfford(drop.price);
  if (needsFunds) {
    label = "Not enough ETH";
    disabled = true;
  }

  return (
    <div className="nab">
      <div className="nab-press">
        <button
          className={`btn btn-nab btn-block ${busy ? "is-busy" : ""}`}
          onClick={() => void claim(dropId, drop.price)}
          disabled={disabled}
        >
          {label}
        </button>
        {state.status === "nabbed" && <Burst key={state.hash} />}
      </div>
      {needsFunds && (
        <FaucetHint>
          You need {formatPrice(drop.price)} plus a little gas. Grab free test ETH, then come back.
        </FaucetHint>
      )}
      {state.status === "pending" && <PendingPanel sentAt={state.sentAt} />}
      <ClaimResult state={state} sentAt={sentAt} />
    </div>
  );
}

function formatMs(ms: number): string {
  return ms < 1_000 ? `${Math.round(ms)}ms` : `${(ms / 1_000).toFixed(2)}s`;
}

/** Milliseconds since `since`, refreshed every frame while `running`. */
function useElapsed(since: number | undefined, running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (since === undefined || !running) return;
    let frame = requestAnimationFrame(function update() {
      setElapsed(performance.now() - since);
      frame = requestAnimationFrame(update);
    });
    return () => cancelAnimationFrame(frame);
  }, [since, running]);
  return elapsed;
}

/** Large live counter plus the race, shown from broadcast until the first receipt. */
function PendingPanel({ sentAt }: { sentAt: number }) {
  const elapsed = useElapsed(sentAt, true);
  return (
    <div className="speed" role="status">
      <span className="sr-only">Nabbing — waiting for the first receipt</span>
      <div className="speed-clock" aria-hidden="true">
        <span className="speed-num">{Math.round(elapsed)}</span>
        <span className="speed-unit">ms</span>
      </div>
      <Race state={{ status: "pending", hash: "0x", sentAt }} sentAt={sentAt} />
    </div>
  );
}

/**
 * Two bars on one time axis: the preconfirmation from Flashblocks and the sealed final block. The
 * gap between them is the speed-up. Bars keep growing until each result is in.
 */
function Race({ state, sentAt }: { state: ClaimState; sentAt: number | undefined }) {
  const nabbed = state.status === "nabbed" ? state : undefined;
  const racing = state.status === "pending" || (nabbed !== undefined && nabbed.final === undefined);
  const elapsed = useElapsed(sentAt, racing);

  const preMs =
    nabbed?.via === "flashblocks"
      ? nabbed.latencyMs
      : state.status === "pending"
        ? elapsed
        : undefined;
  const finalMs = nabbed?.final?.ms ?? (racing ? elapsed : undefined);
  const axis = Math.max(2_000, preMs ?? 0, finalMs ?? 0);
  const width = (ms: number | undefined) => `${Math.min(100, ((ms ?? 0) / axis) * 100)}%`;

  const preDone = nabbed?.via === "flashblocks";
  const finalDone = nabbed?.final !== undefined;
  const gap =
    preDone && finalDone && nabbed.final!.ms > nabbed.latencyMs
      ? nabbed.final!.ms - nabbed.latencyMs
      : undefined;

  return (
    <div className="race">
      <div className="race-row">
        <div className="race-label">
          <span>Preconfirm</span>
          <small>Flashblocks</small>
        </div>
        <div className="race-track" aria-hidden="true">
          <div
            className={`race-fill race-fill-pre ${preDone ? "is-done" : ""}`}
            style={{ width: width(preMs) }}
          />
        </div>
        <div className="race-ms speed-text">
          {preMs !== undefined ? formatMs(preMs) : "—"}
          {preDone && " ⚡"}
        </div>
      </div>
      <div className="race-row">
        <div className="race-label">
          <span>Final block</span>
          <small>Sealed</small>
        </div>
        <div className="race-track" aria-hidden="true">
          <div
            className={`race-fill race-fill-final ${finalDone ? "is-done" : ""}`}
            style={{ width: width(finalMs) }}
          />
        </div>
        <div className="race-ms speed-text">{finalMs !== undefined ? formatMs(finalMs) : "—"}</div>
      </div>
      {gap !== undefined && (
        <p className="race-gap">
          Preconfirmed <span className="speed-text">{formatMs(gap)}</span> before the sealed block.
        </p>
      )}
    </div>
  );
}

/** A restrained, one-shot spray of short ember strokes around the button. */
function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="burst-ray" style={{ ["--a" as string]: `${i * 30}deg` }} />
      ))}
    </span>
  );
}

function ClaimResult({ state, sentAt }: { state: ClaimState; sentAt: number | undefined }) {
  if (state.status === "nabbed") {
    const unit = state.unitIndex !== undefined ? `Unit #${(state.unitIndex + 1n).toString()}` : "";
    return (
      <div className="nab-result nab-success" role="status">
        <div className="nab-latency">
          Nabbed in <span className="mono speed-text">{formatMs(state.latencyMs)}</span>
          {state.via === "flashblocks" && <span className="speed-text"> ⚡</span>}
        </div>
        <Race state={state} sentAt={sentAt} />
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
