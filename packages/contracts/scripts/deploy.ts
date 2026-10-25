import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(`No deployer account for "${network.name}". Set PRIVATE_KEY in .env.`);
  }

  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error(
      "Deployer has no ETH. Fund it from https://faucet.giwa.io or https://faucet.lambda256.io/giwa-sepolia",
    );
  }

  const market = await ethers.deployContract("NabbMarket");
  const deployTx = market.deploymentTransaction();
  console.log(`Deploying NabbMarket... tx ${deployTx?.hash}`);

  await market.waitForDeployment();
  const receipt = await deployTx?.wait();
  const address = await market.getAddress();
  console.log(`NabbMarket deployed at ${address} (block ${receipt?.blockNumber})`);

  const deployment = {
    contract: "NabbMarket",
    network: network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    transactionHash: deployTx?.hash,
    blockNumber: receipt?.blockNumber,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  writeFileSync(outFile, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Saved deployment to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
