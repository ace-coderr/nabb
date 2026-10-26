import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DropCard } from "../components/DropCard";
import { DropFilters } from "../components/DropFilters";
import { useAllDrops } from "../hooks/useAllDrops";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNow } from "../hooks/useNow";
import {
  STATUS_LABEL,
  applyFilter,
  countByStatus,
  parseFilter,
  parseSort,
  sortItems,
  type SortKey,
  type StatusFilter,
} from "../lib/dropList";
import { describeError } from "../lib/errors";

const PAGE_SIZE = 24;

export function Drops() {
  useDocumentTitle(
    "All drops",
    "Browse every Nabb drop on GIWA Sepolia. Filter by status and sort by newest, ending soon or most claimed.",
  );
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get("status"));
  const sort = parseSort(params.get("sort"));
  const [shown, setShown] = useState(PAGE_SIZE);
  const { items, total, truncated, isLoading, error, refetch } = useAllDrops();

  const update = (next: { status?: StatusFilter; sort?: SortKey }) => {
    const copy = new URLSearchParams(params);
    const status = next.status ?? filter;
    const order = next.sort ?? sort;
    if (status === "all") copy.delete("status");
    else copy.set("status", status);
    if (order === "newest") copy.delete("sort");
    else copy.set("sort", order);
    setParams(copy, { replace: true });
    setShown(PAGE_SIZE);
  };

  const counts = useMemo(() => countByStatus(items, now), [items, now]);
  const visible = useMemo(
    () => sortItems(applyFilter(items, filter, now), sort, now),
    [items, filter, sort, now],
  );
  const loaded = !isLoading && !error;

  return (
    <div className="container">
      <div className="page-head">
        <h1>All drops</h1>
        <p className="muted">
          Every drop on NabbMarket, read straight from the contract
          {loaded && total > 0 && <> — {total.toLocaleString()} so far</>}.
        </p>
      </div>

      {loaded && items.length > 0 && (
        <DropFilters
          filter={filter}
          counts={counts}
          onFilter={(status) => update({ status })}
          sort={sort}
          onSort={(order) => update({ sort: order })}
        />
      )}

      {isLoading && (
        <div className="grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
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
          <h2>No drops yet</h2>
          <p className="muted">Nobody has opened a drop on this contract. Be the first.</p>
          <Link to="/create" className="btn btn-primary">
            Create a drop
          </Link>
        </div>
      )}

      {loaded && items.length > 0 && visible.length === 0 && (
        <div className="state card">
          <h2>No {STATUS_LABEL[filter].toLowerCase()} drops</h2>
          <p className="muted">Try another status, or look at everything.</p>
          <button className="btn" onClick={() => update({ status: "all" })}>
            Show all drops
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <p className="muted small results-note" aria-live="polite">
            Showing {Math.min(shown, visible.length)} of {visible.length}
            {truncated && ` (the newest ${items.length} of ${total.toLocaleString()} drops)`}
          </p>
          <div className="grid">
            {visible.slice(0, shown).map((item) => (
              <DropCard key={item.id.toString()} item={item} now={now} />
            ))}
          </div>
          {shown < visible.length && (
            <div className="load-more">
              <button className="btn" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
