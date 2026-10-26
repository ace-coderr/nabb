import { nabbMarket } from "@nabb/config";
import { useMemo } from "react";
import { Link } from "react-router";
import { useAccount, useReadContracts } from "wagmi";
import { CloseDropButton } from "../components/CloseDropButton";
import { ConnectButton } from "../components/ConnectButton";
import { DropArt, PhaseBadge } from "../components/DropBits";
import { useAllDrops } from "../hooks/useAllDrops";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { useMetadata } from "../hooks/useMetadata";
import { useNow } from "../hooks/useNow";
import { claimedOf, phaseOf, type DropListItem } from "../lib/dropList";
import { describeError } from "../lib/errors";
import { formatPrice } from "../lib/format";

export function Me() {
  useDocumentTitle(
    "My activity",
    "Drops you created and drops you claimed with the connected wallet.",
  );
  const now = useNow();
  const { address, isConnected } = useAccount();
  const { wrongChain, ensureChain, switching } = useEnsureChain();
  const { items, isLoading, error, refetch } = useAllDrops();

  // How many units this wallet holds in each drop: one batched read, once per visit.
  const claims = useReadContracts({
    contracts: items.map(
      (item) =>
        ({
          ...nabbMarket,
          functionName: "claimedByWallet",
          args: [item.id, address!],
        }) as const,
    ),
    query: { enabled: isConnected && address !== undefined && items.length > 0 },
  });

  const created = useMemo(
    () => items.filter((item) => item.drop.seller.toLowerCase() === address?.toLowerCase()),
    [items, address],
  );
  const claimed = useMemo(
    () =>
      items.flatMap((item, i) => {
        const result = claims.data?.[i];
        const units = result?.status === "success" ? (result.result as bigint) : 0n;
        return units > 0n ? [{ item, units }] : [];
      }),
    [items, claims.data],
  );

  if (!isConnected || !address) {
    return (
      <div className="container">
        <div className="page-head">
          <h1>My activity</h1>
        </div>
        <div className="state card">
          <h2>Connect a wallet to see your drops</h2>
          <p className="muted">
            This page lists the drops you created and the ones you claimed. It only reads public
            on-chain data for your address.
          </p>
          <ConnectButton size="lg" />
          <Link to="/drops" className="link-quiet">
            Or browse all drops →
          </Link>
        </div>
      </div>
    );
  }

  const loading = isLoading || (items.length > 0 && claims.isLoading);

  return (
    <div className="container">
      <div className="page-head">
        <h1>My activity</h1>
        <p className="muted mono small">{address}</p>
      </div>

      {wrongChain && (
        <div className="notice notice-info notice-row">
          <span>Your wallet is on another network. Switch to GIWA Sepolia to close a drop.</span>
          <button className="btn btn-sm" onClick={() => void ensureChain()} disabled={switching}>
            {switching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}

      {loading && (
        <div className="stack" aria-busy="true">
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {!loading && (error || claims.error) && (
        <div className="state">
          <p className="muted">
            Couldn't load your activity: {describeError(error ?? claims.error)}
          </p>
          <button className="btn" onClick={() => void Promise.all([refetch(), claims.refetch()])}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !claims.error && (
        <>
          <section className="section" aria-labelledby="created-title">
            <div className="section-head">
              <h2 id="created-title">Drops you created</h2>
              <span className="muted small">{created.length}</span>
            </div>
            {created.length === 0 ? (
              <div className="state card">
                <p className="muted">You haven't created a drop yet.</p>
                <Link to="/create" className="btn btn-primary">
                  Create a drop
                </Link>
              </div>
            ) : (
              <ul className="rows">
                {created.map((item) => (
                  <ActivityRow
                    key={item.id.toString()}
                    item={item}
                    now={now}
                    detail={`${claimedOf(item)} of ${item.drop.totalUnits} claimed`}
                    action={
                      item.drop.active && phaseOf(item, now) !== "soldOut" ? (
                        <CloseDropButton dropId={item.id} onClosed={() => void refetch()} />
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="section" aria-labelledby="claimed-title">
            <div className="section-head">
              <h2 id="claimed-title">Drops you claimed</h2>
              <span className="muted small">{claimed.length}</span>
            </div>
            {claimed.length === 0 ? (
              <div className="state card">
                <p className="muted">You haven't nabbed anything yet.</p>
                <Link to="/drops" className="btn">
                  Browse drops
                </Link>
              </div>
            ) : (
              <ul className="rows">
                {claimed.map(({ item, units }) => (
                  <ActivityRow
                    key={item.id.toString()}
                    item={item}
                    now={now}
                    detail={`You hold ${units} ${units === 1n ? "unit" : "units"}`}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ActivityRow({
  item,
  now,
  detail,
  action,
}: {
  item: DropListItem;
  now: number;
  detail: string;
  action?: React.ReactNode;
}) {
  const { data: metadata } = useMetadata(item.drop.metadataURI, item.id);
  const name = metadata?.name ?? `Drop #${item.id}`;
  return (
    <li className="row card">
      <Link to={`/drop/${item.id}`} className="row-art" aria-label={`Open ${name}`}>
        <DropArt image={metadata?.image} name={name} seed={item.id} />
      </Link>
      <div className="row-main">
        <div className="row-top">
          <Link to={`/drop/${item.id}`} className="row-title">
            {name}
          </Link>
          <PhaseBadge phase={phaseOf(item, now)} />
        </div>
        <p className="muted small row-detail">
          <span className="mono">#{item.id.toString()}</span> · {formatPrice(item.drop.price)} ·{" "}
          {detail}
        </p>
      </div>
      {action && <div className="row-action">{action}</div>}
    </li>
  );
}
