import { readFileSync } from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

// Creates a sample drop on the deployed NabbMarket, using the same base64 JSON metadata format as
// the web app. Tweak with DROP_NAME, DROP_PRICE_ETH, DROP_UNITS, DROP_MAX_PER_WALLET, DROP_HOURS.
async function main() {
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const { address } = JSON.parse(readFileSync(deploymentFile, "utf8")) as { address: string };
  const market = await ethers.getContractAt("NabbMarket", address);

  const name = process.env.DROP_NAME ?? "Nabb Genesis Pass";
  const metadata = {
    name,
    description: "The first drop on Nabb. Tap, and it's yours before you blink.",
  };
  const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;
  const price = ethers.parseEther(process.env.DROP_PRICE_ETH ?? "0.0001");
  const totalUnits = BigInt(process.env.DROP_UNITS ?? "50");
  const maxPerWallet = Number(process.env.DROP_MAX_PER_WALLET ?? "2");
  const hours = Number(process.env.DROP_HOURS ?? "168");

  const now = Math.floor(Date.now() / 1000);
  const startTime = BigInt(now - 60);
  const endTime = BigInt(now + hours * 3600);

  const tx = await market.createDrop(
    metadataURI,
    price,
    totalUnits,
    startTime,
    endTime,
    maxPerWallet,
  );
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((log) => market.interface.parseLog(log))
    .find((parsed) => parsed?.name === "DropCreated");

  console.log(`Created "${name}" as drop #${event?.args.dropId} (tx ${tx.hash})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
