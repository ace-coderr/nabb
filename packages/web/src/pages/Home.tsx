import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useActivity, type ActivityItem } from "../activity";
import { DropCard } from "../components/DropCard";
import { DropFilters } from "../components/DropFilters";
import { HeroLive } from "../components/HeroLive";
import { HowSteps } from "../components/HowSteps";
import { SpeedProof } from "../components/SpeedProof";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNow } from "../hooks/useNow";
import { useRecentDrops } from "../hooks/useRecentDrops";
import { FEATURED_DROP_IDS } from "../featured";
import { applyFilter, countByStatus, orderForHome, type StatusFilter } from "../lib/dropList";
import { describeError } from "../lib/errors";
import { CONTRACT_SOURCE_URL } from "../links";

/** How many drops the home page reads, and how many of those it shows. */
const LOADED = 24;
const SHOWN = 12;

export function Home() {
  const now = useNow();
  const { items, isLoading, error, refetch } = useRecentDrops(LOADED);
  const [filter, setFilter] = useState<StatusFilter>("all");
  useDocumentTitle(
    undefined,
    "Claim limited drops onchain. Nabb is a non-custodial claim market on GIWA: the contract pays the creator in the same transaction and never holds your funds.",
  );

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

  const counts = useMemo(() => countByStatus(items, now), [items, now]);
  const entries = useMemo(
    () => orderForHome(applyFilter(items, filter, now), now, FEATURED_DROP_IDS).slice(0, SHOWN),
    [items, filter, now],
  );
  const loaded = !isLoading && !error;

  return (
    <div className="container">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Tap. <span className="accent">Nabbed.</span>
          </h1>
          <p className="hero-sub">
            Claim limited drops onchain. The creator is paid in the same transaction.
          </p>
          <div className="hero-actions">
            <a href="#drops" className="btn btn-primary btn-lg">
              Browse live drops
            </a>
            <Link to="/create" className="link-quiet">
              Create your own →
            </Link>
          </div>
        </div>
        <HeroLive liveCount={loaded ? counts.live : undefined} now={now} />
      </section>

      <section id="drops" className="section" aria-labelledby="drops-title">
        <div className="section-head">
          <h2 id="drops-title">Drops</h2>
          <Link to="/drops" className="link-quiet">
            View all drops →
          </Link>
        </div>

        {loaded && items.length > 0 && (
          <DropFilters filter={filter} counts={counts} onFilter={setFilter} />
        )}

        {isLoading && (
          <div className="grid" aria-busy="true">
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

        {loaded && items.length === 0 && (
          <div className="state card">
            <h3>No drops yet</h3>
            <p className="muted">Be the first — it takes one transaction.</p>
            <Link to="/create" className="btn btn-primary">
              Create the first drop
            </Link>
          </div>
        )}

        {loaded && items.length > 0 && entries.length === 0 && (
          <div className="state card">
            <h3>Nothing here right now</h3>
            <p className="muted">
              No {filter === "soldOut" ? "sold out" : filter} drops among the latest ones.
            </p>
            <Link to="/drops" className="btn">
              Browse every drop
            </Link>
          </div>
        )}

        {entries.length > 0 && (
          <div className="grid">
            {entries.map(({ item, featured }) => (
              <DropCard key={item.id.toString()} item={item} now={now} featured={featured} />
            ))}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="section-head">
          <h2 id="how-title">How it works</h2>
          <Link to="/how-it-works" className="link-quiet">
            Read the details →
          </Link>
        </div>
        <HowSteps />
      </section>

      <section className="section" aria-labelledby="proof-title">
        <div className="section-head">
          <h2 id="proof-title">The speed proof</h2>
        </div>
        <p className="section-lede">
          A claim is preconfirmed as soon as it is in the block the sequencer is building, and final
          when that block is sealed. Nabb shows you both, with real timers, after every claim.
        </p>
        <SpeedProof />
      </section>

      <section className="section split card" aria-labelledby="custody-title">
        <div>
          <h2 id="custody-title">Why non-custodial</h2>
          <p className="section-lede">
            Nabb never holds your funds. When you claim, the contract pays the creator in that same
            transaction and sends back anything you overpaid. There is no balance to drain and no
            withdrawal to wait for.
          </p>
        </div>
        <div className="split-actions">
          <a href={CONTRACT_SOURCE_URL} target="_blank" rel="noreferrer" className="btn">
            Read the verified contract ↗
          </a>
          <Link to="/safety" className="link-quiet">
            How Nabb stays safe →
          </Link>
        </div>
      </section>

      <section className="cta card" aria-labelledby="cta-title">
        <h2 id="cta-title">Have something to hand out?</h2>
        <p className="section-lede">
          Set a price, a number of units and a window. Share the link and let people nab it.
        </p>
        <Link to="/create" className="btn btn-primary btn-lg">
          Create your own drop
        </Link>
      </section>
    </div>
  );
}
