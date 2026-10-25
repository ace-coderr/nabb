import { readFileSync } from "node:fs";
import path from "node:path";
import hre, { network } from "hardhat";

// Verifies the NabbMarket recorded in deployments/<network>.json on the network's explorer.
async function main() {
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const { address } = JSON.parse(readFileSync(deploymentFile, "utf8")) as { address: string };

  console.log(`Verifying NabbMarket at ${address} on ${network.name}...`);
  // The top-level task runs every enabled service (Blockscout here); `verify:verify` is
  // Etherscan-only and silently does nothing when Etherscan is disabled.
  await hre.run("verify", {
    address,
    contract: "contracts/NabbMarket.sol:NabbMarket",
    constructorArgsParams: [],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
