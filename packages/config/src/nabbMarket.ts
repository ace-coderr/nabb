import type { Address, Hash } from "viem";
import { GIWA_SEPOLIA_CHAIN_ID } from "./chain";
import { nabbMarketAbi, nabbMarketDeployments } from "./generated/nabbMarket";

export { nabbMarketAbi };

export interface NabbMarketDeployment {
  address: Address;
  /** Block the contract was deployed in; the indexer starts scanning here. */
  blockNumber: bigint;
  transactionHash: Hash;
}

const deployments: Record<number, NabbMarketDeployment> = Object.fromEntries(
  Object.entries(nabbMarketDeployments).map(([chainId, d]) => [
    Number(chainId),
    {
      address: d.address as Address,
      blockNumber: BigInt(d.blockNumber),
      transactionHash: d.transactionHash as Hash,
    },
  ]),
);

export function getNabbMarketDeployment(chainId: number): NabbMarketDeployment {
  const deployment = deployments[chainId];
  if (!deployment) throw new Error(`NabbMarket is not deployed on chain ${chainId}`);
  return deployment;
}

const giwaSepoliaDeployment = getNabbMarketDeployment(GIWA_SEPOLIA_CHAIN_ID);

/** NabbMarket on GIWA Sepolia. */
export const nabbMarketAddress: Address = giwaSepoliaDeployment.address;
export const nabbMarketDeployBlock: bigint = giwaSepoliaDeployment.blockNumber;

/** Ready to spread into viem/wagmi calls: `{ ...nabbMarket, functionName: "claim", ... }`. */
export const nabbMarket = { address: nabbMarketAddress, abi: nabbMarketAbi } as const;
