import { giwaSepolia, nabbMarket } from "@nabb/config";
import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { describeError } from "../lib/errors";

/** Closes a drop the connected wallet created. Asks first, then waits for the receipt. */
export function CloseDropButton({ dropId, onClosed }: { dropId: bigint; onClosed: () => void }) {
  const publicClient = usePublicClient({ chainId: giwaSepolia.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const { ensureChain } = useEnsureChain();
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState(false);

  if (!publicClient) return null;

  async function close() {
    if (!window.confirm("Close this drop? Nobody will be able to claim from it afterwards.")) {
      return;
    }
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

  const busy = isPending || waiting;
  return (
    <div className="close-drop">
      <button className="btn btn-ghost btn-sm" onClick={() => void close()} disabled={busy}>
        {busy ? "Closing…" : "Close drop"}
      </button>
      {error && <div className="notice notice-error">{error}</div>}
    </div>
  );
}
