import { GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL, GIWA_SEPOLIA_RPC_URL } from "@nabb/config";

// `import.meta.env` only exists under Vite; fall back cleanly when modules run under plain Node.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

/** Standard RPC: transactions and final receipts. */
export const STANDARD_RPC_URL = env.VITE_GIWA_RPC_URL || GIWA_SEPOLIA_RPC_URL;

/** REST feed served by packages/indexer. */
export const INDEXER_URL = (env.VITE_INDEXER_URL || "http://localhost:8787").replace(/\/$/, "");

/** Flashblocks RPC: preconfirmed reads. */
export const FLASHBLOCKS_RPC_URL =
  env.VITE_GIWA_FLASHBLOCKS_RPC_URL || GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL;
