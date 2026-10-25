import { explorerTxUrl } from "@nabb/config";
import { useAccount } from "wagmi";
import { useClaim } from "../hooks/useClaim";
import { useEnsureChain } from "../hooks/useEnsureChain";
import type { Drop, DropPhase } from "../lib/drop";
import { formatDuration, formatPrice } from "../lib/format";
import { ConnectButton } from "./ConnectButton";

interface Props {
  dropId: bigint;
  drop: Drop;
  phase: DropPhase;
  walletClaims: bigint;
  now: number;
  onSettled: () => void;
}

export function NabButton({ dropId, drop, phase, walletClaims, now, onSettled }: Props) {
  const { isConnected } = useAccount();
  const { wrongChain, ensureChain, switching } = useEnsureChain();
  const { state, claim } = useClaim(onSettled);

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

  let label = `Nab it · ${formatPrice(drop.price)}`;
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

  return (
    <div className="nab">
      <button
        className={`btn btn-nab btn-block ${busy ? "is-busy" : ""}`}
        onClick={() => void claim(dropId, drop.price)}
        disabled={disabled}
      >
        {label}
      </button>

      {state.status === "nabbed" && (
        <div className="nab-result nab-success">
          <div className="nab-result-title">
            Nabbed{state.unitIndex !== undefined && ` unit #${(state.unitIndex + 1n).toString()}`}!
          </div>
          <a href={explorerTxUrl(state.hash)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </div>
      )}
      {state.status === "error" && (
        <div className="nab-result nab-error">
          <div>{state.message}</div>
          {state.hash && (
            <a href={explorerTxUrl(state.hash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
        </div>
      )}
    </div>
  );
}
