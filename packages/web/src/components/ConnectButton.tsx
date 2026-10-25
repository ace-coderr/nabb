import { GIWA_SEPOLIA_FAUCETS, giwaSepolia } from "@nabb/config";
import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, type Connector } from "wagmi";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { describeError } from "../lib/errors";
import { formatEth, shortAddress } from "../lib/format";

/** EIP-6963 wallets replace the generic "Injected" entry when any are announced. */
function visibleConnectors(connectors: readonly Connector[]): Connector[] {
  const announced = connectors.filter((c) => c.id !== "injected");
  if (announced.length > 0) return announced;
  const hasProvider = typeof window !== "undefined" && "ethereum" in window;
  return hasProvider ? [...connectors] : [];
}

export function ConnectButton({ size = "md" }: { size?: "md" | "lg" }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { wrongChain, ensureChain, switching } = useEnsureChain();
  const { data: balance } = useBalance({
    address,
    chainId: giwaSepolia.id,
    query: { enabled: isConnected, refetchInterval: 10_000 },
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const btnClass = `btn ${size === "lg" ? "btn-lg btn-block" : ""}`;

  if (isConnected && address) {
    if (wrongChain) {
      return (
        <button
          className={`${btnClass} btn-warn`}
          onClick={() => void ensureChain()}
          disabled={switching}
        >
          {switching ? "Switching…" : "Switch to GIWA Sepolia"}
        </button>
      );
    }
    return (
      <div className="wallet" ref={rootRef}>
        <button className="wallet-chip" onClick={() => setOpen((o) => !o)}>
          {balance && <span className="wallet-balance">{formatEth(balance.value, 4)} ETH</span>}
          <span className="wallet-address">{shortAddress(address)}</span>
        </button>
        {open && (
          <div className="menu">
            <button
              className="menu-item"
              onClick={() => {
                void navigator.clipboard.writeText(address);
                setOpen(false);
              }}
            >
              Copy address
            </button>
            {GIWA_SEPOLIA_FAUCETS.map((faucet) => (
              <a
                key={faucet.url}
                className="menu-item"
                href={faucet.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
              >
                Get test ETH · {faucet.name.replace(/ Faucet$/, "")} ↗
              </a>
            ))}
            <div className="menu-divider" />
            <button
              className="menu-item"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  const options = visibleConnectors(connectors);

  return (
    <div className="wallet" ref={rootRef}>
      <button
        className={`${btnClass} btn-primary`}
        onClick={() => {
          reset();
          setOpen((o) => !o);
        }}
        disabled={isPending}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="menu menu-wide">
          {options.length === 0 ? (
            <div className="menu-empty">
              No browser wallet found.{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                Install MetaMask
              </a>{" "}
              or another EVM wallet, then reload.
            </div>
          ) : (
            options.map((connector) => (
              <button
                key={connector.uid}
                className="menu-item"
                onClick={() => {
                  connect({ connector, chainId: giwaSepolia.id });
                  setOpen(false);
                }}
              >
                {connector.icon && <img src={connector.icon} alt="" className="menu-icon" />}
                {connector.name}
              </button>
            ))
          )}
        </div>
      )}
      {error && !open && <div className="wallet-error">{describeError(error)}</div>}
    </div>
  );
}
