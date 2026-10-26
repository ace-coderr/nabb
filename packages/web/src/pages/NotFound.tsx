import { Link } from "react-router";
import { GeneratedArt } from "../components/GeneratedArt";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Page not found", "That page does not exist on Nabb.");
  return (
    <div className="container notfound">
      <div className="notfound-art" aria-hidden="true">
        <GeneratedArt seed={404n} className="notfound-art-svg" />
      </div>
      <div className="notfound-copy">
        <p className="eyebrow mono">404</p>
        <h1>Nothing to nab here</h1>
        <p className="muted">
          That page doesn't exist, or the link is out of date. The drops are still where you left
          them.
        </p>
        <div className="cta-actions">
          <Link to="/" className="btn btn-primary btn-lg">
            Back to home
          </Link>
          <Link to="/drops" className="btn btn-lg">
            Browse drops
          </Link>
        </div>
      </div>
    </div>
  );
}
