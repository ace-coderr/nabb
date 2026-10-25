import type { nabbMarketAbi } from "@nabb/config";
import type { ReadContractReturnType } from "viem";

export type Drop = ReadContractReturnType<typeof nabbMarketAbi, "getDrop">;

export type DropPhase = "upcoming" | "live" | "soldOut" | "ended" | "closed";

export function dropPhase(drop: Drop, nowSeconds: number): DropPhase {
  if (drop.claimedUnits >= drop.totalUnits) return "soldOut";
  if (!drop.active) return "closed";
  if (nowSeconds < Number(drop.startTime)) return "upcoming";
  if (nowSeconds > Number(drop.endTime)) return "ended";
  return "live";
}

/**
 * The phase from the local clock, corrected by the contract's own `isLive()` when the two
 * disagree (e.g. a skewed device clock). Without `isLive` the local view is used as is.
 */
export function reconciledPhase(drop: Drop, nowSeconds: number, isLive?: boolean): DropPhase {
  const local = dropPhase(drop, nowSeconds);
  if (isLive === undefined || isLive === (local === "live")) return local;
  if (isLive) return "live";
  // The chain says closed while the local clock says open: the chain's time is outside the window.
  const sinceStart = nowSeconds - Number(drop.startTime);
  const untilEnd = Number(drop.endTime) - nowSeconds;
  return sinceStart < untilEnd ? "upcoming" : "ended";
}

export const PHASE_LABEL: Record<DropPhase, string> = {
  upcoming: "Upcoming",
  live: "Live",
  soldOut: "Sold out",
  ended: "Ended",
  closed: "Closed",
};

export function parseDropId(raw: string | undefined): bigint | undefined {
  if (!raw || !/^\d{1,30}$/.test(raw)) return undefined;
  const id = BigInt(raw);
  return id > 0n ? id : undefined;
}
