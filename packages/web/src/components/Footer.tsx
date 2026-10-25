import { GIWA_SEPOLIA_FAUCETS, explorerAddressUrl, nabbMarketAddress } from "@nabb/config";
import { shortAddress } from "../lib/format";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>Need test ETH?</strong>{" "}
          {GIWA_SEPOLIA_FAUCETS.map((faucet, i) => (
            <span key={faucet.url}>
              {i > 0 && " · "}
              <a href={faucet.url} target="_blank" rel="noreferrer">
                {faucet.name}
              </a>
            </span>
          ))}
        </div>
        <div className="footer-meta">
          GIWA Sepolia · NabbMarket{" "}
          <a href={explorerAddressUrl(nabbMarketAddress)} target="_blank" rel="noreferrer">
            {shortAddress(nabbMarketAddress)}
          </a>
        </div>
      </div>
    </footer>
  );
}
