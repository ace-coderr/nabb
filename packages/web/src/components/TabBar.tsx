import { NavLink } from "react-router";
import { ConnectButton } from "./ConnectButton";
import { DropsIcon, PlusIcon, PulseIcon } from "./Icons";

/** Fixed bottom navigation on small screens: Drops, Create, Live, Wallet. */
export function TabBar({
  sheetOpen,
  onToggleLive,
}: {
  sheetOpen: boolean;
  onToggleLive: () => void;
}) {
  return (
    <nav className="tabbar" aria-label="Primary">
      <NavLink to="/" end className="tab">
        <DropsIcon />
        <span>Drops</span>
      </NavLink>
      <NavLink to="/create" className="tab">
        <PlusIcon />
        <span>Create</span>
      </NavLink>
      <button
        type="button"
        className={`tab ${sheetOpen ? "active" : ""}`}
        onClick={onToggleLive}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
      >
        <PulseIcon />
        <span>Live</span>
      </button>
      <ConnectButton variant="tab" />
    </nav>
  );
}
