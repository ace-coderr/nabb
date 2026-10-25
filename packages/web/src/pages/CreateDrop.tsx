import { explorerTxUrl, giwaSepolia, nabbMarket, nabbMarketAbi } from "@nabb/config";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { parseEther, parseEventLogs, type Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ConnectButton } from "../components/ConnectButton";
import { DropArt, ProgressBar } from "../components/DropBits";
import { useEnsureChain } from "../hooks/useEnsureChain";
import { useNow } from "../hooks/useNow";
import { describeError } from "../lib/errors";
import { formatPrice, toDateTimeLocal } from "../lib/format";
import { encodeMetadata, isValidImageInput, safeImageUrl } from "../lib/metadata";

interface FormState {
  name: string;
  description: string;
  image: string;
  price: string;
  totalUnits: string;
  maxPerWallet: string;
  startNow: boolean;
  start: string;
  end: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

type SubmitState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "pending"; hash: Hash }
  | { status: "error"; message: string };

const MAX_UNITS = 1_000_000;
// A small buffer so "start now" drops are already open even if the local clock runs ahead.
const START_NOW_BUFFER_S = 60;

function initialForm(): FormState {
  const now = new Date();
  return {
    name: "",
    description: "",
    image: "",
    price: "0.001",
    totalUnits: "100",
    maxPerWallet: "1",
    startNow: true,
    start: toDateTimeLocal(new Date(now.getTime() + 10 * 60_000)),
    end: toDateTimeLocal(new Date(now.getTime() + 24 * 3_600_000)),
  };
}

function parseIntField(value: string): number | undefined {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

function validate(form: FormState, nowS: number) {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Give your drop a name.";
  else if (form.name.trim().length > 60) errors.name = "Keep the name under 60 characters.";
  if (form.description.trim().length > 280) errors.description = "Keep it under 280 characters.";
  if (form.image.trim() && !isValidImageInput(form.image)) {
    errors.image = "Use an https:// or ipfs:// image link.";
  }

  let price: bigint | undefined;
  if (!/^\d+(\.\d{1,18})?$/.test(form.price.trim()))
    errors.price = "Enter a price in ETH, e.g. 0.01.";
  else price = parseEther(form.price.trim());

  const totalUnits = parseIntField(form.totalUnits);
  if (totalUnits === undefined || totalUnits < 1 || totalUnits > MAX_UNITS) {
    errors.totalUnits = `Between 1 and ${MAX_UNITS.toLocaleString()}.`;
  }
  const maxPerWallet = parseIntField(form.maxPerWallet);
  if (maxPerWallet === undefined || maxPerWallet < 1) errors.maxPerWallet = "At least 1.";
  else if (totalUnits !== undefined && maxPerWallet > totalUnits) {
    errors.maxPerWallet = "Can't exceed the number of units.";
  }

  const startS = form.startNow
    ? Math.floor(nowS) - START_NOW_BUFFER_S
    : Math.floor(new Date(form.start).getTime() / 1000);
  const endS = Math.floor(new Date(form.end).getTime() / 1000);
  if (!form.startNow && Number.isNaN(startS)) errors.start = "Pick a start time.";
  if (Number.isNaN(endS)) errors.end = "Pick an end time.";
  else if (endS <= nowS) errors.end = "The end time must be in the future.";
  else if (!Number.isNaN(startS) && endS <= startS) errors.end = "Must be after the start time.";

  const ok = Object.keys(errors).length === 0;
  return {
    errors,
    values: ok
      ? {
          price: price!,
          totalUnits: BigInt(totalUnits!),
          maxPerWallet: maxPerWallet!,
          startTime: BigInt(startS),
          endTime: BigInt(endS),
        }
      : undefined,
  };
}

export function CreateDrop() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: giwaSepolia.id });
  const { writeContractAsync } = useWriteContract();
  const { ensureChain } = useEnsureChain();
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const now = useNow();
  const { errors, values } = validate(form, now);
  const shownErrors = touched ? errors : {};
  const busy = submit.status === "confirming" || submit.status === "pending";

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!values || !address || !publicClient) return;

    const args = [
      encodeMetadata({ name: form.name, description: form.description, image: form.image }),
      values.price,
      values.totalUnits,
      values.startTime,
      values.endTime,
      values.maxPerWallet,
    ] as const;

    try {
      setSubmit({ status: "confirming" });
      await ensureChain();
      await publicClient.simulateContract({
        ...nabbMarket,
        functionName: "createDrop",
        args,
        account: address,
      });
      const hash = await writeContractAsync({
        ...nabbMarket,
        functionName: "createDrop",
        args,
        chainId: giwaSepolia.id,
      });
      setSubmit({ status: "pending", hash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const [created] = parseEventLogs({
        abi: nabbMarketAbi,
        eventName: "DropCreated",
        logs: receipt.logs,
      });
      if (receipt.status !== "success" || !created) {
        setSubmit({ status: "error", message: "The transaction reverted. Please try again." });
        return;
      }
      navigate(`/drop/${created.args.dropId}`, { state: { justCreated: true } });
    } catch (error) {
      setSubmit({ status: "error", message: describeError(error) });
    }
  }

  const previewName = form.name.trim() || "Your drop";
  const units = values?.totalUnits ?? BigInt(parseIntField(form.totalUnits) ?? 0);

  return (
    <div className="container">
      <div className="page-head">
        <h1>Create a drop</h1>
        <p className="muted">
          A fixed number of identical units at a fixed price. Every claim pays you directly — the
          contract never holds funds.
        </p>
      </div>

      <div className="create-grid">
        <form className="card form" onSubmit={onSubmit} noValidate>
          <Field label="Name" error={shownErrors.name}>
            <input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Genesis pass"
              maxLength={80}
            />
          </Field>
          <Field label="Description" hint="Optional" error={shownErrors.description}>
            <textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What do claimers get?"
              rows={3}
            />
          </Field>
          <Field label="Image URL" hint="Optional · https:// or ipfs://" error={shownErrors.image}>
            <input
              value={form.image}
              onChange={(e) => set("image")(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <div className="field-row">
            <Field label="Price (ETH)" hint="0 for free" error={shownErrors.price}>
              <input
                value={form.price}
                onChange={(e) => set("price")(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Units" error={shownErrors.totalUnits}>
              <input
                value={form.totalUnits}
                onChange={(e) => set("totalUnits")(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Per wallet" error={shownErrors.maxPerWallet}>
              <input
                value={form.maxPerWallet}
                onChange={(e) => set("maxPerWallet")(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={form.startNow}
              onChange={(e) => set("startNow")(e.target.checked)}
            />
            Open immediately
          </label>

          <div className="field-row">
            {!form.startNow && (
              <Field label="Opens" error={shownErrors.start}>
                <input
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => set("start")(e.target.value)}
                />
              </Field>
            )}
            <Field label="Closes" error={shownErrors.end}>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => set("end")(e.target.value)}
              />
            </Field>
          </div>

          {isConnected ? (
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {submit.status === "confirming" && "Confirm in your wallet…"}
              {submit.status === "pending" && "Creating drop…"}
              {(submit.status === "idle" || submit.status === "error") && "Create drop"}
            </button>
          ) : (
            <ConnectButton size="lg" />
          )}

          {submit.status === "pending" && (
            <p className="muted small center">
              Submitted ·{" "}
              <a href={explorerTxUrl(submit.hash)} target="_blank" rel="noreferrer">
                view transaction
              </a>
            </p>
          )}
          {submit.status === "error" && <div className="notice notice-error">{submit.message}</div>}
        </form>

        <aside className="preview">
          <div className="muted small preview-label">Preview</div>
          <div className="card drop-card">
            <DropArt image={safeImageUrl(form.image)} name={previewName} seed={0n} />
            <div className="drop-card-body">
              <h3 className="drop-card-title">{previewName}</h3>
              <div className="drop-card-row">
                <span className="price">{values ? formatPrice(values.price) : "—"}</span>
                <span className="muted">
                  {units.toString()} / {units.toString()} left
                </span>
              </div>
              <ProgressBar claimed={0n} total={1n} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "field-invalid" : ""}`}>
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
