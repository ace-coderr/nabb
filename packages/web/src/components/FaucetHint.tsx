import { GIWA_SEPOLIA_FAUCETS } from "@nabb/config";

/** Inline nudge to the GIWA Sepolia faucets, shown when the wallet can't cover an action. */
export function FaucetHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice notice-info faucet-hint">
      <span>{children}</span>
      <span className="faucet-links">
        {GIWA_SEPOLIA_FAUCETS.map((faucet) => (
          <a key={faucet.url} href={faucet.url} target="_blank" rel="noreferrer">
            {faucet.name} ↗
          </a>
        ))}
      </span>
    </div>
  );
}
