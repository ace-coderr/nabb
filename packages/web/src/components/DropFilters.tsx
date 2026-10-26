import {
  SORT_KEYS,
  SORT_LABEL,
  STATUS_FILTERS,
  STATUS_LABEL,
  type SortKey,
  type StatusFilter,
} from "../lib/dropList";

/** Status chips with counts, and an optional sort menu. Controlled by the parent. */
export function DropFilters({
  filter,
  counts,
  onFilter,
  sort,
  onSort,
}: {
  filter: StatusFilter;
  counts: Record<StatusFilter, number>;
  onFilter: (filter: StatusFilter) => void;
  sort?: SortKey;
  onSort?: (sort: SortKey) => void;
}) {
  return (
    <div className="filters">
      <div className="chips" role="group" aria-label="Filter drops by status">
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${filter === value ? "chip-on" : ""}`}
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            {STATUS_LABEL[value]}
            <span className="chip-count">{counts[value]}</span>
          </button>
        ))}
      </div>
      {sort && onSort && (
        <label className="sort">
          <span className="sort-label">Sort</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            {SORT_KEYS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
