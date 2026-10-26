import { Link, NavLink } from "react-router";
import { useAccount } from "wagmi";
import { ConnectButton } from "./ConnectButton";
import { BoltIcon } from "./Icons";

export function Header() {
  const { isConnected } = useAccount();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="logo" aria-label="Nabb home">
          <BoltIcon width={22} height={22} />
          nabb
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/drops">Drops</NavLink>
          <NavLink to="/create">Create</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          {isConnected && <NavLink to="/me">My activity</NavLink>}
        </nav>
        <span className="net-pill">
          <span className="net-dot" />
          GIWA Sepolia
        </span>
        <div className="topbar-wallet">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
