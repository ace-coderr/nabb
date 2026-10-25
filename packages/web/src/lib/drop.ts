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
