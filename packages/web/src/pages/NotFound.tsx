import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="container state">
      <h1>Nothing to nab here</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link to="/" className="btn">
        Back to drops
      </Link>
    </div>
  );
}
