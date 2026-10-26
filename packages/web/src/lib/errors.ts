import { ContractFunctionRevertedError } from "viem";

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  SoldOut: "Sold out — every unit has been nabbed.",
  NotStarted: "This drop hasn't opened yet.",
  Ended: "This drop has ended.",
  DropInactive: "The creator closed this drop.",
  DropNotFound: "This drop doesn't exist.",
  WalletLimitReached: "You've already nabbed the maximum for this drop.",
  InsufficientPayment: "Not enough ETH was sent for this drop.",
  SellerPaymentFailed: "The creator's address can't receive ETH, so this drop can't be claimed.",
  RefundFailed: "Your wallet couldn't receive the refund for overpaying.",
  NotSeller: "Only the creator can do that.",
  InvalidUnits: "Units must be at least 1.",
  InvalidMaxPerWallet: "Per-wallet limit must be at least 1.",
  InvalidWindow: "The end time must be after the start time and in the future.",
};

function* causeChain(error: unknown): Generator<unknown> {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    yield current;
    current = (current as { cause?: unknown }).cause;
  }
}

/** Name of the NabbMarket custom error behind a failed call, if any. */
export function contractErrorName(error: unknown): string | undefined {
  for (const e of causeChain(error)) {
    if (e instanceof ContractFunctionRevertedError) return e.data?.errorName;
  }
  return undefined;
}

export function isUserRejection(error: unknown): boolean {
  for (const e of causeChain(error)) {
    const { name, code } = e as { name?: string; code?: number };
    if (code === 4001 || name === "UserRejectedRequestError") return true;
  }
  return false;
}

interface ErrorLike {
  name?: string;
  code?: number;
  status?: number;
  message?: string;
  shortMessage?: string;
}

function findInChain(error: unknown, test: (e: ErrorLike) => boolean): boolean {
  for (const e of causeChain(error)) if (test(e as ErrorLike)) return true;
  return false;
}

/** The RPC refused for rate-limit reasons (HTTP 429 or the JSON-RPC "limit exceeded" code). */
export function isRateLimited(error: unknown): boolean {
  return findInChain(
    error,
    (e) =>
      e.status === 429 ||
      e.code === -32005 ||
      /rate.?limit|too many requests|429/i.test(e.shortMessage ?? e.message ?? ""),
  );
}

/**
 * A failure of the network path rather than of the transaction itself: timeouts, dropped
 * connections, rate limits and unreachable RPCs. Safe to retry, and never a reason to conclude that
 * a claim would revert.
 */
export function isTransientRpcError(error: unknown): boolean {
  if (contractErrorName(error) !== undefined || isUserRejection(error)) return false;
  return (
    isRateLimited(error) ||
    findInChain(error, (e) =>
      ["HttpRequestError", "TimeoutError", "WebSocketRequestError"].includes(e.name ?? ""),
    )
  );
}

const MAX_MESSAGE_LENGTH = 200;

/** A one-line, human message for any wallet, RPC or contract error. */
export function describeError(error: unknown): string {
  if (isUserRejection(error)) return "Request cancelled in your wallet.";

  const errorName = contractErrorName(error);
  if (errorName && CONTRACT_ERROR_MESSAGES[errorName]) return CONTRACT_ERROR_MESSAGES[errorName];

  const named = (name: string) => findInChain(error, (e) => e.name === name);
  const coded = (code: number) => findInChain(error, (e) => e.code === code);

  if (named("InsufficientFundsError")) {
    return "Not enough ETH in your wallet. Get free test ETH from the faucets linked below.";
  }
  if (coded(-32002)) {
    return "Your wallet already has a request waiting. Open it and confirm or reject it, then try again.";
  }
  if (named("NonceTooLowError") || named("NonceTooHighError") || named("NonceMaxValueError")) {
    return "Your wallet's transaction counter is out of sync. Wait for any pending transaction to finish, or reset the account in your wallet's advanced settings.";
  }
  if (named("ChainNotConfiguredError") || named("SwitchChainError") || coded(4902)) {
    return "Your wallet couldn't switch to GIWA Sepolia. Add it manually (chain id 91342) and try again.";
  }
  if (named("ConnectorNotFoundError") || named("ProviderNotFoundError")) {
    return "No browser wallet was found. Install one such as MetaMask, then reload.";
  }
  if (isRateLimited(error)) {
    return "The network is rate-limiting requests right now. Wait a few seconds and try again.";
  }
  if (named("TimeoutError")) return "The network took too long to answer. Please try again.";
  if (named("HttpRequestError")) {
    return "Couldn't reach the network. Check your connection and try again.";
  }

  const first = error as ErrorLike | undefined;
  const message = first?.shortMessage ?? first?.message ?? "Something went wrong.";
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message;
}
