import cors from "@fastify/cors";
import type { IndexedClaim, IndexedDrop, IndexerHealth, IndexerPage } from "@nabb/config";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { ClaimRecord, DropRecord, Page, SnapshotMeta, Store } from "./store";

/** The sync loop counts as healthy if it completed a step this recently. */
const STALE_AFTER_MS = 30_000;

export interface ServerOptions {
  meta: SnapshotMeta;
  /** `true` reflects any origin; otherwise an explicit allow-list. */
  corsOrigin: true | string[];
  logger?: FastifyServerOptions["logger"];
}

function toDropDto(d: DropRecord): IndexedDrop {
  return {
    id: d.id.toString(),
    seller: d.seller,
    metadataURI: d.metadataURI,
    price: d.price.toString(),
    totalUnits: d.totalUnits.toString(),
    claimedUnits: d.claimedUnits.toString(),
    startTime: d.startTime.toString(),
    endTime: d.endTime.toString(),
    maxPerWallet: d.maxPerWallet,
    active: d.active,
    createdAt: d.createdAt,
    createdBlock: d.createdBlock.toString(),
    createdTx: d.createdTx,
  };
}

function toClaimDto(c: ClaimRecord): IndexedClaim {
  return {
    id: c.id,
    dropId: c.dropId.toString(),
    claimer: c.claimer,
    unitIndex: c.unitIndex.toString(),
    pricePaid: c.pricePaid.toString(),
    timestamp: c.timestamp,
    blockNumber: c.blockNumber.toString(),
    txHash: c.txHash,
    logIndex: c.logIndex,
  };
}

function toPage<T, U>(page: Page<T>, map: (item: T) => U): IndexerPage<U> {
  return { items: page.items.map(map), nextCursor: page.nextCursor };
}

const uintString = { type: "string", pattern: "^[0-9]{1,30}$" } as const;
const limit = (max: number, fallback: number) =>
  ({ type: "integer", minimum: 1, maximum: max, default: fallback }) as const;
const idParams = {
  type: "object",
  properties: { id: uintString },
  required: ["id"],
} as const;

interface PageQuery {
  limit: number;
  before?: string;
}

export function buildServer(store: Store, { meta, corsOrigin, logger = false }: ServerOptions) {
  // Clients poll several endpoints every few seconds; per-request lines would drown the sync logs.
  const app = Fastify({ logger, disableRequestLogging: true });

  void app.register(cors, { origin: corsOrigin, methods: ["GET"] });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("cache-control", "no-store");
    return payload;
  });

  app.get("/health", async (): Promise<IndexerHealth> => {
    const lag = store.headBlock > store.indexedBlock ? store.headBlock - store.indexedBlock : 0n;
    return {
      ok: store.lastSyncedAt > 0 && Date.now() - store.lastSyncedAt < STALE_AFTER_MS,
      chainId: meta.chainId,
      contract: meta.contract,
      indexedBlock: store.indexedBlock.toString(),
      headBlock: store.headBlock.toString(),
      lagBlocks: lag.toString(),
      drops: store.dropCount,
      claims: store.claimCount,
    };
  });

  app.get<{ Querystring: PageQuery }>(
    "/drops",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: limit(100, 20), before: uintString },
          additionalProperties: false,
        },
      },
    },
    async (request): Promise<IndexerPage<IndexedDrop>> => {
      const { limit, before } = request.query;
      return toPage(
        store.listDrops({ limit, before: before === undefined ? undefined : BigInt(before) }),
        toDropDto,
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    "/drops/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const drop = store.getDrop(BigInt(request.params.id));
      if (!drop) return reply.code(404).send({ error: "Drop not found" });
      return toDropDto(drop);
    },
  );

  app.get<{ Params: { id: string }; Querystring: PageQuery }>(
    "/drops/:id/claims",
    {
      schema: {
        params: idParams,
        querystring: {
          type: "object",
          properties: { limit: limit(200, 50), before: uintString },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { limit, before } = request.query;
      const page = store.listDropClaims(BigInt(request.params.id), {
        limit,
        before: before === undefined ? undefined : BigInt(before),
      });
      if (!page) return reply.code(404).send({ error: "Drop not found" });
      return toPage(page, toClaimDto);
    },
  );

  app.get<{ Querystring: PageQuery }>(
    "/claims",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: limit(200, 50), before: uintString },
          additionalProperties: false,
        },
      },
    },
    async (request): Promise<IndexerPage<IndexedClaim>> => {
      const { limit, before } = request.query;
      return toPage(
        store.listClaims({ limit, before: before === undefined ? undefined : Number(before) }),
        toClaimDto,
      );
    },
  );

  return app;
}
