import { defineChain } from "viem";
import { chainConfig } from "viem/op-stack";

export const GIWA_SEPOLIA_CHAIN_ID = 91342;

/** Standard RPC: send transactions here and treat it as the source of truth. */
export const GIWA_SEPOLIA_RPC_URL = "https://sepolia-rpc.giwa.io";

/** Flashblocks RPC: preconfirmed state, ~200ms ahead of sealed blocks. Use for fast reads. */
export const GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL = "https://sepolia-rpc-flashblocks.giwa.io";

export const GIWA_SEPOLIA_EXPLORER_URL = "https://sepolia-explorer.giwa.io";

export const GIWA_SEPOLIA_FAUCETS = [
  { name: "GIWA Faucet", url: "https://faucet.giwa.io" },
  { name: "Lambda256 Faucet", url: "https://faucet.lambda256.io/giwa-sepolia" },
] as const;

/** GIWA Sepolia, an OP Stack L2. `rpcUrls.flashblocks` carries the preconfirmation endpoint. */
export const giwaSepolia = defineChain({
  ...chainConfig,
  id: GIWA_SEPOLIA_CHAIN_ID,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockTime: 1_000,
  rpcUrls: {
    default: { http: [GIWA_SEPOLIA_RPC_URL] },
    flashblocks: { http: [GIWA_SEPOLIA_FLASHBLOCKS_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "GIWA Sepolia Explorer", url: GIWA_SEPOLIA_EXPLORER_URL },
  },
  contracts: {
    ...chainConfig.contracts,
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

export function explorerTxUrl(hash: string): string {
  return `${GIWA_SEPOLIA_EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${GIWA_SEPOLIA_EXPLORER_URL}/address/${address}`;
}
