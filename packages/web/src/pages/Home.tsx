import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useActivity, type ActivityItem } from "../activity";
import { DropCard } from "../components/DropCard";
import { GeneratedArt } from "../components/GeneratedArt";
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

  // The list is already refreshed every few seconds; a rise in a drop's claimed count is a claim we
  // can show in the ticker without asking the chain for anything extra.
  const { push } = useActivity();
  const claimedSeen = useRef(new Map<string, bigint>());
  useEffect(() => {
    const found: ActivityItem[] = [];
    for (const item of items) {
      const key = item.id.toString();
      const left = item.remaining ?? item.drop.totalUnits - item.drop.claimedUnits;
      const claimed = item.drop.totalUnits - left;
      const before = claimedSeen.current.get(key);
      if (before !== undefined && claimed > before) {
        found.push({
          id: `seen:${key}:${claimed}`,
          dropId: item.id,
          timestamp: Math.floor(Date.now() / 1000),
          count: Number(claimed - before),
        });
      }
      claimedSeen.current.set(key, claimed);
    }
    if (found.length > 0) push(found);
  }, [items, push]);

  return (
    <div className="container">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="pulse" /> Live on GIWA Sepolia
          </p>
          <h1>
            Tap. <span className="accent">Nabbed.</span>
          </h1>
          <p className="hero-sub">
            Limited drops, claimed onchain in a fraction of a second. Payments go straight to the
            creator — Nabb never holds your funds.
          </p>
          <div className="hero-actions">
            <a href="#drops" className="btn btn-primary btn-lg">
              Browse live drops
            </a>
            <Link to="/create" className="link-quiet">
              or create your own →
            </Link>
          </div>
          <ul className="hero-facts">
            <li>Non-custodial</li>
            <li>Fixed price</li>
            <li>Flashblocks speed</li>
          </ul>
        </div>
        <div className="hero-art" aria-hidden="true">
          <GeneratedArt seed={7n} className="hero-art-svg" />
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
