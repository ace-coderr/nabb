import { GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL, GIWA_SEPOLIA_RPC_URL } from "@nabb/config";

/** Standard RPC: transactions and final receipts. */
export const STANDARD_RPC_URL = import.meta.env.VITE_GIWA_RPC_URL || GIWA_SEPOLIA_RPC_URL;

/** Flashblocks RPC: preconfirmed reads. */
export const FLASHBLOCKS_RPC_URL =
  import.meta.env.VITE_GIWA_FLASHBLOCKS_RPC_URL || GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL;
