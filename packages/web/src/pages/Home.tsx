import { useState } from "react";
import { Link } from "react-router";
import { DropCard } from "../components/DropCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNow } from "../hooks/useNow";
import { useRecentDrops } from "../hooks/useRecentDrops";
import { describeError } from "../lib/errors";

const PAGE_SIZE = 12;

export function Home() {
  const now = useNow();
  const [count, setCount] = useState(PAGE_SIZE);
  const { items, hasMore, isLoading, error, refetch } = useRecentDrops(count);
  useDocumentTitle();

  return (
    <div className="container">
      <section className="hero">
        <h1>
          Tap. <span className="accent">Nabbed.</span>
        </h1>
        <p className="hero-sub">
          Limited drops, claimed onchain in a fraction of a second. Payments go straight to the
          creator — Nabb never holds your funds.
        </p>
        <div className="hero-actions">
          <Link to="/create" className="btn btn-primary btn-lg">
            Create a drop
          </Link>
          <a href="#drops" className="btn btn-lg">
            Browse drops
          </a>
        </div>
      </section>

      <section id="drops">
        <div className="section-head">
          <h2>Latest drops</h2>
        </div>

        {isLoading && (
          <div className="grid">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="state">
            <p className="muted">Couldn't load drops: {describeError(error)}</p>
            <button className="btn" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="state card">
            <h3>No drops yet</h3>
            <p className="muted">Be the first — it takes one transaction.</p>
            <Link to="/create" className="btn btn-primary">
              Create the first drop
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid">
            {items.map((item) => (
              <DropCard key={item.id.toString()} item={item} now={now} />
            ))}
          </div>
        )}

        {items.length > 0 && hasMore && (
          <div className="load-more">
            <button className="btn" onClick={() => setCount((c) => c + PAGE_SIZE)}>
              Show older drops
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
