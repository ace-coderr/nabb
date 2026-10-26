import { GIWA_SEPOLIA_FAUCETS, giwaSepolia } from "@nabb/config";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAccount, useBalance, useConnect, useDisconnect, type Connector } from "wagmi";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { describeError } from "../lib/errors";
import { formatEth, shortAddress } from "../lib/format";
import { WalletIcon } from "./Icons";

/** EIP-6963 wallets replace the generic "Injected" entry when any are announced. */
function visibleConnectors(connectors: readonly Connector[]): Connector[] {
  const announced = connectors.filter((c) => c.id !== "injected");
  if (announced.length > 0) return announced;
  const hasProvider = typeof window !== "undefined" && "ethereum" in window;
  return hasProvider ? [...connectors] : [];
}

/**
 * Wallet connect / account menu. `variant="tab"` renders it as a bottom-tab-bar item whose menu
 * opens upward.
 */
export function ConnectButton({
  size = "md",
  variant = "default",
}: {
  size?: "md" | "lg";
  variant?: "default" | "tab";
}) {
  const tab = variant === "tab";
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { wrongChain, ensureChain, switching } = useEnsureChain();
  const { data: balance } = useBalance({
    address,
    chainId: giwaSepolia.id,
    // The tab-bar variant never shows the balance, so only the header instance refreshes it.
    query: { enabled: isConnected && !tab, refetchInterval: 10_000 },
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btnClass = `btn ${size === "lg" ? "btn-lg btn-block" : ""}`;
  const menuClass = `menu ${tab ? "menu-up" : ""}`;

  if (isConnected && address) {
    if (wrongChain) {
      return (
        <button
          className={tab ? "tab tab-warn" : `${btnClass} btn-warn`}
          onClick={() => void ensureChain()}
          disabled={switching}
        >
          {tab ? (
            <>
              <WalletIcon />
              <span>{switching ? "Switching…" : "Switch"}</span>
            </>
          ) : switching ? (
            "Switching…"
          ) : (
            "Switch to GIWA Sepolia"
          )}
        </button>
      );
    }
    return (
      <div className="wallet" ref={rootRef}>
        <button
          className={tab ? `tab ${open ? "active" : ""}` : "wallet-chip"}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {tab ? (
            <>
              <WalletIcon />
              <span>{shortAddress(address)}</span>
            </>
          ) : (
            <>
              {balance && (
                <span className="wallet-balance">
                  <span className="sr-only">Balance </span>
                  {formatEth(balance.value, 4)} ETH
                </span>
              )}
              <span className="wallet-address">{shortAddress(address)}</span>
            </>
          )}
        </button>
        {open && (
          <div className={menuClass} role="menu">
            <Link to="/me" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
              My activity
            </Link>
            <button
              className="menu-item"
              role="menuitem"
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
                role="menuitem"
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
              role="menuitem"
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
        className={tab ? `tab ${open ? "active" : ""}` : `${btnClass} btn-primary`}
        onClick={() => {
          reset();
          setOpen((o) => !o);
        }}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {tab ? (
          <>
            <WalletIcon />
            <span>{isPending ? "Connecting…" : "Wallet"}</span>
          </>
        ) : isPending ? (
          "Connecting…"
        ) : (
          "Connect wallet"
        )}
      </button>
      {open && (
        <div className={`${menuClass} menu-wide`} role="menu">
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
                role="menuitem"
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
