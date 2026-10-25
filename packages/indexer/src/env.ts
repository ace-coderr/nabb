import { GIWA_SEPOLIA_RPC_URL } from "@nabb/config";
import path from "node:path";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export const env = {
  port: int("PORT", 8787),
  host: process.env.HOST || "0.0.0.0",
  rpcUrl: process.env.GIWA_SEPOLIA_RPC_URL || GIWA_SEPOLIA_RPC_URL,
  confirmations: BigInt(int("CONFIRMATIONS", 2)),
  pollIntervalMs: int("POLL_INTERVAL_MS", 1_000),
  snapshotFile: path.resolve(process.env.DATA_DIR || "data", "giwa-sepolia.json"),
  corsOrigin:
    !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*"
      ? (true as const)
      : process.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  logLevel: process.env.LOG_LEVEL || "info",
};
