import { useState } from "react";
import { Link } from "react-router";
import { CloseIcon } from "./Icons";

const DISMISSED_KEY = "nabb.testnet-banner.dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** A dismissible reminder that nothing here involves real money. Remembered when storage allows. */
export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not persisted; the banner is simply hidden for this visit.
    }
  };

  return (
    <div className="banner" role="region" aria-label="Testnet notice">
      <p className="banner-text">
        <strong>Testnet: no real funds.</strong> The ETH here is free and worth nothing.{" "}
        <Link to="/safety">Safety</Link>
      </p>
      <button
        type="button"
        className="icon-btn"
        onClick={dismiss}
        aria-label="Dismiss testnet notice"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
