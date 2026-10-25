import "@nomicfoundation/hardhat-toolbox";
import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

loadEnv({ quiet: true });

const GIWA_SEPOLIA_RPC_URL = process.env.GIWA_SEPOLIA_RPC_URL ?? "https://sepolia-rpc.giwa.io";
const GIWA_SEPOLIA_EXPLORER_URL = "https://sepolia-explorer.giwa.io";

function deployerAccounts(): string[] {
  const key = process.env.PRIVATE_KEY?.trim();
  if (!key) return [];
  return [key.startsWith("0x") ? key : `0x${key}`];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 10_000 },
      evmVersion: "cancun",
    },
  },
  networks: {
    giwaSepolia: {
      url: GIWA_SEPOLIA_RPC_URL,
      chainId: 91342,
      accounts: deployerAccounts(),
    },
  },
  // The GIWA Sepolia explorer runs Blockscout, which needs no API key.
  blockscout: {
    enabled: true,
    customChains: [
      {
        network: "giwaSepolia",
        chainId: 91342,
        urls: {
          apiURL: `${GIWA_SEPOLIA_EXPLORER_URL}/api`,
          browserURL: GIWA_SEPOLIA_EXPLORER_URL,
        },
      },
    ],
  },
  etherscan: { enabled: false },
  sourcify: { enabled: false },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
};

export default config;
