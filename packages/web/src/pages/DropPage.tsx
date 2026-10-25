import { explorerAddressUrl, giwaSepolia, nabbMarket } from "@nabb/config";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ClaimFeed } from "../components/ClaimFeed";
import { DropArt, PhaseBadge, ProgressBar } from "../components/DropBits";
import { NabButton } from "../components/NabButton";
import { useClaimFeed } from "../hooks/useClaimFeed";
import { useDrop } from "../hooks/useDrop";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { useMetadata } from "../hooks/useMetadata";
import { useNow } from "../hooks/useNow";
import { dropPhase, parseDropId, type Drop } from "../lib/drop";
import { describeError } from "../lib/errors";
import { formatDateTime, formatDuration, formatPrice, shortAddress } from "../lib/format";

export function DropPage() {
  const params = useParams();
  const dropId = parseDropId(params.dropId);
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated === true;
  const now = useNow();
  const { drop, isLoading, notFound, error, walletClaims, applyClaims, applyOwnClaim, refetch } =
    useDrop(dropId);
  const { data: metadata } = useMetadata(drop?.metadataURI, dropId);
  // Each new preconfirmed claim moves the counters straight away, then a fresh read confirms them.
  const feed = useClaimFeed(notFound ? undefined : dropId, (claims) => {
    applyClaims(claims);
    void refetch();
  });

  if (dropId === undefined || notFound) {
    return (
      <div className="container state">
        <h1>Drop not found</h1>
        <p className="muted">There's no drop with that id on GIWA Sepolia.</p>
        <Link to="/" className="btn">
          Browse drops
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container drop-layout">
        <div className="skeleton skeleton-art" />
        <div className="drop-info">
          <div className="skeleton skeleton-line w-30" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line w-80" />
          <div className="skeleton skeleton-button" />
        </div>
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="container state">
        <h1>Couldn't load this drop</h1>
        <p className="muted">{error ? describeError(error) : "The RPC didn't respond."}</p>
        <button className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const phase = dropPhase(drop, now);
  const name = metadata?.name ?? `Drop #${dropId}`;
  const left = drop.totalUnits - drop.claimedUnits;

  return (
    <div className="container">
      {justCreated && (
        <div className="notice notice-success">
          Your drop is live on-chain. Share this page so people can nab it.
        </div>
      )}
      <div className="drop-layout">
        <DropArt image={metadata?.image} name={name} seed={dropId} />

        <div className="drop-info">
          <div className="drop-card-top">
            <PhaseBadge phase={phase} />
            <span className="muted mono">#{dropId.toString()}</span>
          </div>
          <h1 className="drop-title">{name}</h1>
          {metadata?.description && <p className="drop-description">{metadata.description}</p>}
          <div className="muted small">
            by{" "}
            <a href={explorerAddressUrl(drop.seller)} target="_blank" rel="noreferrer">
              {shortAddress(drop.seller)}
            </a>
          </div>

          <div className="stats">
            <div>
              <div className="stat-label">Price</div>
              <div className="stat-value">{formatPrice(drop.price)}</div>
            </div>
            <div>
              <div className="stat-label">Left</div>
              <div className="stat-value">
                {left.toString()}
                <span className="muted"> / {drop.totalUnits.toString()}</span>
              </div>
            </div>
            <div>
              <div className="stat-label">{phase === "upcoming" ? "Opens in" : "Ends in"}</div>
              <div className="stat-value">
                {phase === "upcoming" && formatDuration(Number(drop.startTime) - now)}
                {phase === "live" && formatDuration(Number(drop.endTime) - now)}
                {phase !== "upcoming" && phase !== "live" && "—"}
              </div>
            </div>
          </div>

          <ProgressBar claimed={drop.claimedUnits} total={drop.totalUnits} />

          <NabButton
            dropId={dropId}
            drop={drop}
            phase={phase}
            walletClaims={walletClaims}
            now={now}
            onPreconfirmed={(claim, broadcastAt) => {
              if (claim) {
                applyClaims([claim]);
                feed.addClaims([claim]);
              }
              applyOwnClaim(broadcastAt);
            }}
            onSettled={() => void refetch()}
          />

          <div className="muted small drop-meta">
            <span>
              You've nabbed {walletClaims.toString()} / {drop.maxPerWallet}
            </span>
            <span>
              {formatDateTime(drop.startTime)} → {formatDateTime(drop.endTime)}
            </span>
          </div>

          <SellerControls dropId={dropId} drop={drop} onClosed={() => void refetch()} />
        </div>
      </div>

      <ClaimFeed claims={feed.claims} status={feed.status} history={feed.history} now={now} />
    </div>
  );
}

function SellerControls({
  dropId,
  drop,
  onClosed,
}: {
  dropId: bigint;
  drop: Drop;
  onClosed: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: giwaSepolia.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const { ensureChain } = useEnsureChain();
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState(false);

  const isSeller = address?.toLowerCase() === drop.seller.toLowerCase();
  if (!isSeller || !drop.active || !publicClient) return null;

  async function close() {
    if (!window.confirm("Close this drop? Nobody will be able to claim from it afterwards."))
      return;
    setError(undefined);
    try {
      await ensureChain();
      const hash = await writeContractAsync({
        ...nabbMarket,
        functionName: "closeDrop",
        args: [dropId],
        chainId: giwaSepolia.id,
      });
      setWaiting(true);
      await publicClient!.waitForTransactionReceipt({ hash });
      onClosed();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setWaiting(false);
    }
  }

  return (
    <div className="seller">
      <span className="muted small">You created this drop.</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => void close()}
        disabled={isPending || waiting}
      >
        {isPending || waiting ? "Closing…" : "Close drop"}
      </button>
      {error && <div className="notice notice-error">{error}</div>}
    </div>
  );
}
