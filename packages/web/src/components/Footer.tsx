import { Link } from "react-router";
import { CONTRACT_ADDRESS, CONTRACT_URL, EXPLORER_URL, FAUCETS, GITHUB_URL } from "../links";
import { shortAddress } from "../lib/format";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <nav aria-label="Site" className="footer-col">
            <h2 className="footer-title">Nabb</h2>
            <Link to="/drops">Drops</Link>
            <Link to="/create">Create</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/safety">Safety</Link>
          </nav>
          <nav aria-label="Elsewhere" className="footer-col">
            <h2 className="footer-title">Elsewhere</h2>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={EXPLORER_URL} target="_blank" rel="noreferrer">
              Explorer
            </a>
            {FAUCETS.map((faucet) => (
              <a key={faucet.url} href={faucet.url} target="_blank" rel="noreferrer">
                {faucet.name}
              </a>
            ))}
          </nav>
          <div className="footer-col footer-note">
            <h2 className="footer-title">On-chain</h2>
            <p className="muted small">Runs on GIWA Sepolia, a test network.</p>
            <a href={CONTRACT_URL} target="_blank" rel="noreferrer">
              NabbMarket {shortAddress(CONTRACT_ADDRESS)}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
