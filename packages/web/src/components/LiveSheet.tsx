import { useEffect, useRef } from "react";
import { useActivity } from "../activity";
import { ActivityList } from "./ActivityList";
import { CloseIcon } from "./Icons";

/** Mobile bottom sheet with the live activity list. */
export function LiveSheet({ onClose }: { onClose: () => void }) {
  const { items } = useActivity();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Live activity"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="live-title">
            <span className="pulse" /> Live activity
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close live activity"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">
          <ActivityList
            items={items}
            onNavigate={onClose}
            emptyText="Nothing yet. Open a drop and claims will stream in here."
          />
        </div>
      </div>
    </div>
  );
}
