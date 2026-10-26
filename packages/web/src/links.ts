import {
  GIWA_SEPOLIA_CHAIN_ID,
  GIWA_SEPOLIA_EXPLORER_URL,
  GIWA_SEPOLIA_FAUCETS,
  explorerAddressUrl,
  nabbMarketAddress,
  nabbMarketDeployBlock,
} from "@nabb/config";

/** External links used across the site. Everything on-chain comes from @nabb/config. */
export const GITHUB_URL = "https://github.com/ace-coderr/nabb";
export const EXPLORER_URL = GIWA_SEPOLIA_EXPLORER_URL;
export const FAUCET_URL = GIWA_SEPOLIA_FAUCETS[0].url;
export const CHAIN_ID = GIWA_SEPOLIA_CHAIN_ID;
export const CONTRACT_ADDRESS = nabbMarketAddress;
export const CONTRACT_DEPLOY_BLOCK = nabbMarketDeployBlock;
export const CONTRACT_URL = explorerAddressUrl(nabbMarketAddress);
/** The verified source tab on the explorer. */
export const CONTRACT_SOURCE_URL = `${CONTRACT_URL}#code`;
export { GIWA_SEPOLIA_FAUCETS as FAUCETS };
