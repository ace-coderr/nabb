import { ContractFunctionRevertedError } from "viem";
import { GIWA_SEPOLIA_FAUCETS } from "@nabb/config";

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

/** A one-line, human message for any wallet, RPC or contract error. */
export function describeError(error: unknown): string {
  if (isUserRejection(error)) return "Request cancelled in your wallet.";

  const errorName = contractErrorName(error);
  if (errorName && CONTRACT_ERROR_MESSAGES[errorName]) return CONTRACT_ERROR_MESSAGES[errorName];

  for (const e of causeChain(error)) {
    if ((e as { name?: string }).name === "InsufficientFundsError") {
      return `Not enough ETH in your wallet. Top up at ${GIWA_SEPOLIA_FAUCETS[0].url}`;
    }
  }

  const first = error as { shortMessage?: string; message?: string } | undefined;
  return first?.shortMessage ?? first?.message ?? "Something went wrong.";
}
