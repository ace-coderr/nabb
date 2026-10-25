import { giwaSepolia, nabbMarketAddress, nabbMarketDeployBlock } from "@nabb/config";
import { createPublicClient, http } from "viem";
import { env } from "./env";
import { buildServer } from "./server";
import { loadSnapshot, saveSnapshot } from "./snapshot";
import { Store } from "./store";
import { startSync } from "./sync";

const SNAPSHOT_EVERY_MS = 5_000;

const meta = { chainId: giwaSepolia.id, contract: nabbMarketAddress };

const store = (await loadSnapshot(env.snapshotFile, meta)) ?? new Store(nabbMarketDeployBlock);
const app = buildServer(store, {
  meta,
  corsOrigin: env.corsOrigin,
  logger: { level: env.logLevel },
});
app.log.info(
  { indexedBlock: store.indexedBlock.toString(), drops: store.dropCount, claims: store.claimCount },
  store.dropCount > 0 || store.indexedBlock >= nabbMarketDeployBlock
    ? "resumed from snapshot"
    : "starting from the deploy block",
);

const client = createPublicClient({ chain: giwaSepolia, transport: http(env.rpcUrl) });
const sync = startSync({
  client,
  store,
  log: app.log,
  confirmations: env.confirmations,
  pollIntervalMs: env.pollIntervalMs,
});

const persist = async () => {
  if (!store.dirty) return;
  try {
    await saveSnapshot(env.snapshotFile, store, meta);
  } catch (error) {
    app.log.error({ err: error }, "failed to save snapshot");
  }
};
const persistTimer = setInterval(() => void persist(), SNAPSHOT_EVERY_MS);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  clearInterval(persistTimer);
  await sync.stop();
  await persist();
  await app.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: env.port, host: env.host });
