import { useActivity } from "../activity";
import { ActivityList } from "./ActivityList";
import { ChevronIcon, PulseIcon } from "./Icons";

/** Desktop side column. Collapsible; shows the same buffer as the ticker. */
export function LiveColumn({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { items } = useActivity();

  return (
    <aside className="live-col" aria-label="Live activity">
      <div className="live-head">
        {!collapsed && (
          <h2 className="live-title">
            <span className="pulse" /> Live activity
          </h2>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand live activity" : "Collapse live activity"}
          title={collapsed ? "Expand live activity" : "Collapse live activity"}
        >
          {collapsed ? <PulseIcon /> : <ChevronIcon />}
        </button>
      </div>
      {!collapsed && (
        <div className="live-body">
          <ActivityList items={items} />
        </div>
      )}
    </aside>
  );
}
