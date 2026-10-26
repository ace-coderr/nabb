import { Link } from "react-router";
import { useAccount } from "wagmi";
import { useActivity } from "../activity";
import { activityText } from "./ActivityList";
import { BoltIcon } from "./Icons";

/**
 * Slim marquee under the top bar. It is decorative duplication of the live column / sheet (which
 * are the accessible versions), so it is hidden from assistive tech and not focusable.
 */
export function Ticker() {
  const { items, seedStatus } = useActivity();
  const { address } = useAccount();

  const entries = items.slice(0, 20).map((item) => {
    const mine = address !== undefined && item.claimer?.toLowerCase() === address.toLowerCase();
    return { item, text: activityText(item, mine) };
  });

  const track = (hidden: boolean) =>
    entries.map(({ item, text }) => (
      <Link
        key={`${hidden ? "b" : "a"}-${item.id}`}
        to={`/drop/${item.dropId}`}
        className="ticker-item"
        tabIndex={-1}
      >
        <BoltIcon width={12} height={12} />
        <span className="mono ticker-drop">#{item.dropId.toString()}</span>
        {text}
      </Link>
    ));

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-inner">
        <div className="ticker-label">
          <span className="pulse" /> Live
        </div>
        <div className="ticker-window">
          {entries.length === 0 ? (
            <span className="ticker-idle">
              {seedStatus === "loading"
                ? "Loading recent claims…"
                : "No claims yet — be the first to nab one."}
            </span>
          ) : (
            <div
              className="ticker-track"
              style={{ animationDuration: `${Math.max(24, entries.length * 7)}s` }}
            >
              <div className="ticker-run">{track(false)}</div>
              <div className="ticker-run">{track(true)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
