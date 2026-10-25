# Nabb

**Tap. Nabbed.** Nabb is a real-time, non-custodial claim market on [GIWA](https://sepolia-explorer.giwa.io), an OP Stack Ethereum L2. A creator opens a _drop_ — a limited run of identical units at a fixed price — and anyone can hit **Nab it** to claim one. Payment goes straight to the creator inside the claim transaction; the contract never holds funds.

The point is speed. Claims are confirmed from GIWA's Flashblocks preconfirmations, so an on-chain claim feels like a web tap, and the app shows exactly how long it took: **"Nabbed in 180ms ⚡"**.

---

## How it works

### Drops and claims

`NabbMarket` is a single registry contract holding every drop.

- **`createDrop(metadataURI, price, totalUnits, startTime, endTime, maxPerWallet)`** opens a drop. The caller is the seller.
- **`claim(dropId)`** (payable) checks that the drop is active, inside its time window, not sold out, under the caller's per-wallet limit, and that `msg.value >= price`. It then:
  1. records the claim (and marks the drop inactive when the last unit goes),
  2. forwards **exactly `price`** to the seller — the whole claim reverts if that transfer fails,
  3. refunds any excess to the claimer — also reverting on failure,
  4. emits `Claimed(dropId, claimer, unitIndex, pricePaid, timestamp)`.
- **`closeDrop(dropId)`** lets the seller stop a drop early.
- Views: `getDrop`, `remaining`, `isLive`, `claimedByWallet`.

Because every claim pays out and refunds in the same transaction (and the contract has no `receive`/`fallback`), the contract's balance is always zero between transactions. `claim` is protected by OpenZeppelin's `ReentrancyGuard`; the test suite covers reentrant sellers and claimers, rejecting receivers, boundary timestamps and the zero-balance invariant.

### The real-time path (Flashblocks)

GIWA's sequencer streams **flashblocks** — ~200ms slices of the block it is building — ahead of each sealed 1s block. Nabb uses two RPC endpoints:

| Client       | Endpoint                                  | Used for                                                 |
| ------------ | ----------------------------------------- | -------------------------------------------------------- |
| **standard** | `https://sepolia-rpc.giwa.io`             | Sending transactions (via the wallet) and final receipts |
| **flash**    | `https://sepolia-rpc-flashblocks.giwa.io` | Preconfirmed receipts, `pending` state and the live feed |

1. **Instant confirmation.** Right after the wallet broadcasts a claim, the app polls `getTransactionReceipt` on the Flashblocks RPC every ~50ms (up to a 3s timeout). The time from broadcast to the first receipt is the number shown in **"Nabbed in {ms}ms ⚡"**. The standard RPC's sealed receipt is awaited in the background and shown as "Final in block N"; if Flashblocks doesn't answer in time, the standard receipt is used instead.
2. **Live claim feed.** The drop page polls `getLogs` for `Claimed` with `toBlock: 'pending'` every ~250ms. On GIWA, `pending` resolves to the latest flashblock, so other people's claims appear about a second after they are sent. Entries are de-duplicated by `txHash:logIndex`.
3. **Fresh state.** Drop counters and claim dry-runs read the `pending` block, so "units left" and sold-out checks reflect the latest flashblock. Your own claim updates the counters and the feed the moment its receipt arrives.

All Flashblocks reads live in one module: [`packages/web/src/lib/flashblocks.ts`](packages/web/src/lib/flashblocks.ts).

> The measured latency includes the network round trip to GIWA's RPC. Near the RPC it lands around 200ms; from far away, expect roughly one round trip on top.

### Reading drops and history

The web app needs nothing but the chain. The drops list reads NabbMarket directly — ids `nextDropId - 1` down to 1, one multicall of `getDrop` / `remaining` / `isLive` per page — and each drop's claim history is read from `Claimed` logs, walking sealed blocks back from the head until every claim the drop reports has been found. New claims arrive through the Flashblocks feed.

The **indexer** (`packages/indexer`) is an optional extra: a small Fastify service that tails `DropCreated`, `Claimed` and `DropClosed` and serves the same data over REST. The app uses it only when `VITE_INDEXER_URL` is set **and** its `/health` check passes for this chain and contract; otherwise it falls back to the on-chain path without any visible change. The deployed site runs without one.

```
                     ┌──────────── claim tx ────────────┐
   browser wallet ───┘                                   ▼
                                               standard RPC ──▶ GIWA sequencer
   web app ◀── receipts (50ms) / pending logs (250ms) ── Flashblocks RPC
   web app ◀── drops (multicall) / claim history (logs) ── standard RPC
   web app ◀┄┄ optional REST: drops, claim history ┄┄ indexer ◀── sealed logs ── standard RPC
```

---

## Repository layout

| Package                                    | What it is                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| [`packages/contracts`](packages/contracts) | `NabbMarket.sol`, tests, deploy and demo scripts (Hardhat + TypeScript)        |
| [`packages/config`](packages/config)       | GIWA Sepolia viem chain, NabbMarket ABI + deployment, shared indexer API types |
| [`packages/web`](packages/web)             | React + Vite app (wagmi v2, viem v2)                                           |
| [`packages/indexer`](packages/indexer)     | Optional event indexer and REST API (Node + Fastify), local use                |

## GIWA Sepolia

| Setting         | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| Chain ID        | `91342`                                                           |
| Currency        | ETH (18 decimals)                                                 |
| Standard RPC    | `https://sepolia-rpc.giwa.io`                                     |
| Flashblocks RPC | `https://sepolia-rpc-flashblocks.giwa.io`                         |
| Explorer        | https://sepolia-explorer.giwa.io                                  |
| Faucets         | https://faucet.giwa.io · https://faucet.lambda256.io/giwa-sepolia |

**NabbMarket** is deployed at [`0xF956a04217FB14428A74AC5aFB8D7302C4ac53df`](https://sepolia-explorer.giwa.io/address/0xF956a04217FB14428A74AC5aFB8D7302C4ac53df) (block 39578724) and its source is [verified on the explorer](https://sepolia-explorer.giwa.io/address/0xF956a04217FB14428A74AC5aFB8D7302C4ac53df#code). The address and deploy block are recorded in [`packages/contracts/deployments/giwaSepolia.json`](packages/contracts/deployments/giwaSepolia.json) and exported from `@nabb/config`.

---

## Getting started

### Prerequisites

- Node.js **20.19+** (or 22.12+)
- pnpm **9** (`corepack enable` picks up the pinned version)
- A browser wallet (MetaMask or any EIP-6963 wallet)
- Some GIWA Sepolia ETH from a [faucet](https://faucet.giwa.io)

### Run locally

```bash
pnpm install
pnpm dev
```

This starts both:

- **web** on http://localhost:5173
- **indexer** on http://localhost:8787 (first run backfills from the deploy block in a few seconds)

Open the web app, connect your wallet (it offers to add/switch to GIWA Sepolia), create a drop and nab it. In development the app points at the local indexer through the committed `packages/web/.env.development`; `pnpm dev:web` on its own works too and simply reads everything on-chain. To run the indexer alone: `pnpm dev:indexer`.

### Configuration

Everything works with no configuration. Optional overrides:

**`packages/web/.env`**

| Variable                        | Default                                   |
| ------------------------------- | ----------------------------------------- |
| `VITE_GIWA_RPC_URL`             | `https://sepolia-rpc.giwa.io`             |
| `VITE_GIWA_FLASHBLOCKS_RPC_URL` | `https://sepolia-rpc-flashblocks.giwa.io` |
| `VITE_INDEXER_URL`              | unset — on-chain reads only               |

**`packages/indexer/.env`** (read from the process environment)

| Variable               | Default                       | Meaning                                       |
| ---------------------- | ----------------------------- | --------------------------------------------- |
| `PORT` / `HOST`        | `8787` / `0.0.0.0`            | Listen address                                |
| `GIWA_SEPOLIA_RPC_URL` | `https://sepolia-rpc.giwa.io` | RPC to index from                             |
| `CONFIRMATIONS`        | `2`                           | Blocks to stay behind the head (reorg margin) |
| `POLL_INTERVAL_MS`     | `1000`                        | Delay between polls once caught up            |
| `DATA_DIR`             | `./data`                      | Where the state snapshot is written           |
| `CORS_ORIGIN`          | `*`                           | Comma-separated allowed origins               |
| `LOG_LEVEL`            | `info`                        | Log level                                     |

**`packages/contracts/.env`** — only needed to deploy. See below.

Every `.env` file is gitignored; each package has a `.env.example`.

---

## Deploy to Vercel

The web app ships as a static site that talks straight to GIWA Sepolia — no server or indexer needed.

1. In Vercel, **Add New → Project** and import this repository.
2. Leave **Root Directory** as the repository root. All build settings come from [`vercel.json`](vercel.json):
   - install: `pnpm install`
   - build: `pnpm --filter @nabb/web build`
   - output: `packages/web/dist`
   - every path rewrites to `/index.html`, so `/create` and `/drop/:id` work on direct visits and refreshes.
3. Deploy. **No environment variables are required.**

To use a hosted indexer, set `VITE_INDEXER_URL` to its HTTPS URL (and allow the site's origin with the indexer's `CORS_ORIGIN`). The site checks its health first and falls back to on-chain reads whenever it is unavailable.

To reproduce the production build locally:

```bash
pnpm --filter @nabb/web build
pnpm --filter @nabb/web preview
```

---

## Contracts

```bash
pnpm --filter @nabb/contracts test                   # unit tests
pnpm --filter @nabb/contracts coverage               # coverage report
REPORT_GAS=true pnpm --filter @nabb/contracts test   # gas report
```

### Deploying

1. Create `packages/contracts/.env` from the example and set the deployer key:

   ```bash
   cp packages/contracts/.env.example packages/contracts/.env
   ```

   ```dotenv
   PRIVATE_KEY=0x...
   ```

2. Fund the deployer address from a [faucet](https://faucet.giwa.io).
3. Deploy:

   ```bash
   pnpm contracts:deploy
   ```

   This writes the address, transaction and block to `packages/contracts/deployments/giwaSepolia.json`.

4. Sync the ABI and deployment into the shared config:

   ```bash
   pnpm config:sync
   ```

   This regenerates `packages/config/src/generated/nabbMarket.ts`, which the web app and indexer import. Commit both files.

5. Verify the source on the GIWA Sepolia explorer (Blockscout — no API key needed):

   ```bash
   pnpm contracts:verify
   ```

   This reads the address from the deployment file and submits the source with the same compiler settings used to deploy.

6. Optionally create a sample drop with the deployer:

   ```bash
   pnpm contracts:demo-drop
   ```

   Tune it with `DROP_NAME`, `DROP_PRICE_ETH`, `DROP_UNITS`, `DROP_MAX_PER_WALLET` and `DROP_HOURS`.

The indexer keys its snapshot to the chain and contract address, so after a redeploy it starts fresh from the new deploy block on its own.

---

## Indexer

The indexer is optional and meant for local use; the deployed site does not need it.

```bash
pnpm --filter @nabb/indexer dev     # watch mode
pnpm --filter @nabb/indexer test    # store + API tests
pnpm --filter @nabb/indexer build   # bundles to dist/index.js
pnpm --filter @nabb/indexer start   # runs the bundle
```

It reads sealed blocks from the standard RPC in chunks, derives counters and status purely from events (replaying a range is idempotent), and saves a snapshot to `DATA_DIR` every few seconds and on shutdown so restarts resume where they left off.

### API

Integers that can exceed 2^53 (wei, unit counts, block numbers) are returned as decimal strings. Lists are newest first; pass `nextCursor` back as `before` for the next page.

| Endpoint                                       | Returns                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `GET /health`                                  | Sync status: indexed block, head, lag, counts |
| `GET /drops?limit=20&before=<dropId>`          | Drops                                         |
| `GET /drops/:id`                               | One drop (404 if unknown)                     |
| `GET /drops/:id/claims?limit=50&before=<unit>` | Claims for a drop                             |
| `GET /claims?limit=50&before=<cursor>`         | Claims across all drops                       |

Response types are exported from `@nabb/config` (`IndexedDrop`, `IndexedClaim`, `IndexerPage`, `IndexerHealth`).

---

## Scripts

| Command                     | Does                                                     |
| --------------------------- | -------------------------------------------------------- |
| `pnpm dev`                  | Web + indexer in watch mode                              |
| `pnpm build`                | Compile contracts, bundle the indexer, build the web app |
| `pnpm test`                 | Contract and indexer tests                               |
| `pnpm typecheck`            | Type-check every package                                 |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                        |
| `pnpm contracts:deploy`     | Deploy NabbMarket to GIWA Sepolia                        |
| `pnpm contracts:verify`     | Verify NabbMarket's source on the GIWA Sepolia explorer  |
| `pnpm contracts:demo-drop`  | Create a sample drop                                     |
| `pnpm config:sync`          | Refresh the ABI + deployment in `@nabb/config`           |

---

## Notes

- **Testnet software.** NabbMarket has a full test suite but has not been audited.
- **Fixed prices.** The price of a drop never changes once it is created.
- **Claim history** shows up to the 50 most recent claims per drop, read from chain logs (or the indexer when one is in use).
- **Metadata** for drops created in the app is stored on-chain as a base64 JSON `data:` URI (`name`, `description`, `image`); `ipfs://` and `https://` JSON URIs are also supported.
