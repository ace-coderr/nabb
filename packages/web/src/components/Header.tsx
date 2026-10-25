import { Link, NavLink } from "react-router";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="Nabb home">
          <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
            <path d="M36 6 14 36h14l-4 22 26-32H35z" fill="currentColor" />
          </svg>
          nabb
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Drops
          </NavLink>
          <NavLink to="/create">Create</NavLink>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
