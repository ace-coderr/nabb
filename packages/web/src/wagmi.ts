import { giwaSepolia } from "@nabb/config";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { STANDARD_RPC_URL } from "./env";

// Browser wallets announced via EIP-6963 are discovered automatically and appear alongside the
// generic injected connector.
export const wagmiConfig = createConfig({
  chains: [giwaSepolia],
  connectors: [injected()],
  transports: {
    [giwaSepolia.id]: http(STANDARD_RPC_URL),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
