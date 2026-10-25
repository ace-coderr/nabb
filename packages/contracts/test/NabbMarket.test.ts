import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { MarketActorMock, NabbMarket } from "../typechain-types";

const PRICE = ethers.parseEther("0.01");
const URI = "ipfs://nabb-test-drop";

interface DropParams {
  metadataURI: string;
  price: bigint;
  totalUnits: bigint;
  startTime: bigint;
  endTime: bigint;
  maxPerWallet: bigint;
}

async function defaultParams(overrides: Partial<DropParams> = {}): Promise<DropParams> {
  const now = BigInt(await time.latest());
  return {
    metadataURI: URI,
    price: PRICE,
    totalUnits: 3n,
    startTime: now + 60n,
    endTime: now + 3600n,
    maxPerWallet: 2n,
    ...overrides,
  };
}

function create(market: NabbMarket | MarketActorMock, signer: HardhatEthersSigner, p: DropParams) {
  return market
    .connect(signer)
    .createDrop(p.metadataURI, p.price, p.totalUnits, p.startTime, p.endTime, p.maxPerWallet);
}

async function marketBalance(market: NabbMarket) {
  return ethers.provider.getBalance(await market.getAddress());
}

describe("NabbMarket", () => {
  async function deployFixture() {
    const [deployer, seller, alice, bob, carol] = await ethers.getSigners();
    const market = await ethers.deployContract("NabbMarket");
    const actor = await ethers.deployContract("MarketActorMock", [await market.getAddress()]);
    return { market, actor, deployer, seller, alice, bob, carol };
  }

  /** Deploys, creates drop #1 from `seller` and moves time to its start. */
  async function liveDropFixture() {
    const ctx = await deployFixture();
    const params = await defaultParams();
    await create(ctx.market, ctx.seller, params);
    await time.increaseTo(params.startTime);
    return { ...ctx, params, dropId: 1n };
  }

  describe("createDrop", () => {
    it("stores the drop, starts ids at 1 and emits DropCreated", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      const p = await defaultParams();

      expect(await market.nextDropId()).to.equal(1n);
      await expect(create(market, seller, p))
        .to.emit(market, "DropCreated")
        .withArgs(1n, seller.address, p.price, p.totalUnits, p.startTime, p.endTime);

      const drop = await market.getDrop(1n);
      expect(drop.seller).to.equal(seller.address);
      expect(drop.metadataURI).to.equal(p.metadataURI);
      expect(drop.price).to.equal(p.price);
      expect(drop.totalUnits).to.equal(p.totalUnits);
      expect(drop.claimedUnits).to.equal(0n);
      expect(drop.startTime).to.equal(p.startTime);
      expect(drop.endTime).to.equal(p.endTime);
      expect(drop.maxPerWallet).to.equal(p.maxPerWallet);
      expect(drop.active).to.equal(true);
      expect(await market.nextDropId()).to.equal(2n);
    });

    it("assigns sequential ids across sellers", async () => {
      const { market, seller, alice } = await loadFixture(deployFixture);
      await create(market, seller, await defaultParams());
      await expect(create(market, alice, await defaultParams()))
        .to.emit(market, "DropCreated")
        .withArgs(2n, alice.address, anyUint, anyUint, anyUint, anyUint);
      expect((await market.getDrop(2n)).seller).to.equal(alice.address);
    });

    it("allows a start time in the past", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      const now = BigInt(await time.latest());
      await create(market, seller, await defaultParams({ startTime: now - 100n }));
      expect(await market.isLive(1n)).to.equal(true);
    });

    it("rejects zero units", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(
        create(market, seller, await defaultParams({ totalUnits: 0n })),
      ).to.be.revertedWithCustomError(market, "InvalidUnits");
    });

    it("rejects a zero per-wallet limit", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(
        create(market, seller, await defaultParams({ maxPerWallet: 0n })),
      ).to.be.revertedWithCustomError(market, "InvalidMaxPerWallet");
    });

    it("rejects an end time at or before the start time", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      const p = await defaultParams();
      await expect(
        create(market, seller, { ...p, endTime: p.startTime }),
      ).to.be.revertedWithCustomError(market, "InvalidWindow");
      await expect(
        create(market, seller, { ...p, endTime: p.startTime - 1n }),
      ).to.be.revertedWithCustomError(market, "InvalidWindow");
    });

    it("rejects an end time that has already passed", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      const now = BigInt(await time.latest());
      await expect(
        create(market, seller, await defaultParams({ startTime: now - 100n, endTime: now })),
      ).to.be.revertedWithCustomError(market, "InvalidWindow");
    });
  });

  describe("claim", () => {
    it("pays the seller exactly the price and emits Claimed", async () => {
      const { market, seller, alice, dropId } = await loadFixture(liveDropFixture);

      const tx = market.connect(alice).claim(dropId, { value: PRICE });
      await expect(tx).to.changeEtherBalances([seller, alice, market], [PRICE, -PRICE, 0n]);

      const block = await ethers.provider.getBlock("latest");
      await expect(tx)
        .to.emit(market, "Claimed")
        .withArgs(dropId, alice.address, 0n, PRICE, BigInt(block!.timestamp));

      const drop = await market.getDrop(dropId);
      expect(drop.claimedUnits).to.equal(1n);
      expect(await market.claimedByWallet(dropId, alice.address)).to.equal(1n);
      expect(await market.remaining(dropId)).to.equal(2n);
    });

    it("refunds any excess payment to the claimer", async () => {
      const { market, seller, alice, dropId } = await loadFixture(liveDropFixture);
      const overpay = PRICE * 5n;

      await expect(market.connect(alice).claim(dropId, { value: overpay })).to.changeEtherBalances(
        [seller, alice, market],
        [PRICE, -PRICE, 0n],
      );
      expect(await marketBalance(market)).to.equal(0n);
    });

    it("emits increasing zero-based unit indexes", async () => {
      const { market, alice, bob, carol, dropId } = await loadFixture(liveDropFixture);

      await expect(market.connect(alice).claim(dropId, { value: PRICE }))
        .to.emit(market, "Claimed")
        .withArgs(dropId, alice.address, 0n, PRICE, anyUint);
      await expect(market.connect(bob).claim(dropId, { value: PRICE }))
        .to.emit(market, "Claimed")
        .withArgs(dropId, bob.address, 1n, PRICE, anyUint);
      await expect(market.connect(carol).claim(dropId, { value: PRICE }))
        .to.emit(market, "Claimed")
        .withArgs(dropId, carol.address, 2n, PRICE, anyUint);
    });

    it("deactivates the drop when the last unit is claimed and rejects further claims", async () => {
      const { market, alice, bob, carol, dropId } = await loadFixture(liveDropFixture);

      await market.connect(alice).claim(dropId, { value: PRICE });
      await market.connect(bob).claim(dropId, { value: PRICE });
      expect((await market.getDrop(dropId)).active).to.equal(true);

      await market.connect(carol).claim(dropId, { value: PRICE });
      const drop = await market.getDrop(dropId);
      expect(drop.active).to.equal(false);
      expect(drop.claimedUnits).to.equal(drop.totalUnits);
      expect(await market.remaining(dropId)).to.equal(0n);
      expect(await market.isLive(dropId)).to.equal(false);

      await expect(market.connect(alice).claim(dropId, { value: PRICE }))
        .to.be.revertedWithCustomError(market, "SoldOut")
        .withArgs(dropId);
    });

    it("enforces the per-wallet limit", async () => {
      const { market, alice, bob, dropId } = await loadFixture(liveDropFixture);

      await market.connect(alice).claim(dropId, { value: PRICE });
      await market.connect(alice).claim(dropId, { value: PRICE });
      await expect(market.connect(alice).claim(dropId, { value: PRICE }))
        .to.be.revertedWithCustomError(market, "WalletLimitReached")
        .withArgs(dropId);

      // Another wallet can still take the last unit.
      await expect(market.connect(bob).claim(dropId, { value: PRICE })).to.emit(market, "Claimed");
    });

    it("tracks per-wallet limits independently per drop", async () => {
      const { market, seller, alice, params } = await loadFixture(liveDropFixture);
      await create(market, seller, { ...params, maxPerWallet: 1n });

      await market.connect(alice).claim(1n, { value: PRICE });
      await market.connect(alice).claim(1n, { value: PRICE });
      await market.connect(alice).claim(2n, { value: PRICE });
      await expect(market.connect(alice).claim(2n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "WalletLimitReached",
      );
    });

    it("rejects underpayment", async () => {
      const { market, alice, dropId } = await loadFixture(liveDropFixture);
      await expect(market.connect(alice).claim(dropId, { value: PRICE - 1n }))
        .to.be.revertedWithCustomError(market, "InsufficientPayment")
        .withArgs(PRICE, PRICE - 1n);
      await expect(market.connect(alice).claim(dropId))
        .to.be.revertedWithCustomError(market, "InsufficientPayment")
        .withArgs(PRICE, 0n);
    });

    it("rejects unknown drops", async () => {
      const { market, alice } = await loadFixture(deployFixture);
      await expect(market.connect(alice).claim(0n, { value: PRICE }))
        .to.be.revertedWithCustomError(market, "DropNotFound")
        .withArgs(0n);
      await expect(market.connect(alice).claim(42n, { value: PRICE }))
        .to.be.revertedWithCustomError(market, "DropNotFound")
        .withArgs(42n);
    });

    it("supports free drops without transferring ETH", async () => {
      const { market, seller, alice } = await loadFixture(deployFixture);
      const p = await defaultParams({ price: 0n });
      await create(market, seller, p);
      await time.increaseTo(p.startTime);

      await expect(market.connect(alice).claim(1n)).to.changeEtherBalances(
        [seller, alice, market],
        [0n, 0n, 0n],
      );
      // Anything sent to a free drop is refunded in full.
      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.changeEtherBalances(
        [seller, alice, market],
        [0n, 0n, 0n],
      );
    });

    describe("time window", () => {
      it("rejects claims before the start time", async () => {
        const { market, seller, alice } = await loadFixture(deployFixture);
        await create(market, seller, await defaultParams());
        await expect(market.connect(alice).claim(1n, { value: PRICE }))
          .to.be.revertedWithCustomError(market, "NotStarted")
          .withArgs(1n);
      });

      it("accepts a claim exactly at the start time", async () => {
        const { market, seller, alice } = await loadFixture(deployFixture);
        const p = await defaultParams();
        await create(market, seller, p);

        await time.setNextBlockTimestamp(p.startTime - 1n);
        await expect(
          market.connect(alice).claim(1n, { value: PRICE }),
        ).to.be.revertedWithCustomError(market, "NotStarted");

        await time.setNextBlockTimestamp(p.startTime);
        await expect(market.connect(alice).claim(1n, { value: PRICE })).to.emit(market, "Claimed");
      });

      it("accepts a claim exactly at the end time and rejects one after it", async () => {
        const { market, seller, alice, bob } = await loadFixture(deployFixture);
        const p = await defaultParams();
        await create(market, seller, p);

        await time.setNextBlockTimestamp(p.endTime);
        await expect(market.connect(alice).claim(1n, { value: PRICE })).to.emit(market, "Claimed");

        await time.setNextBlockTimestamp(p.endTime + 1n);
        await expect(market.connect(bob).claim(1n, { value: PRICE }))
          .to.be.revertedWithCustomError(market, "Ended")
          .withArgs(1n);
      });
    });

    describe("transfer failures", () => {
      it("reverts the whole claim when the seller cannot receive ETH", async () => {
        const { market, actor, alice } = await loadFixture(deployFixture);
        const p = await defaultParams();
        await actor.createDrop(
          p.metadataURI,
          p.price,
          p.totalUnits,
          p.startTime,
          p.endTime,
          p.maxPerWallet,
        );
        await actor.configure(false, false, 0n);
        await time.increaseTo(p.startTime);

        await expect(market.connect(alice).claim(1n, { value: PRICE }))
          .to.be.revertedWithCustomError(market, "SellerPaymentFailed")
          .withArgs(1n);
        expect((await market.getDrop(1n)).claimedUnits).to.equal(0n);
        expect(await market.claimedByWallet(1n, alice.address)).to.equal(0n);
      });

      it("reverts when an overpaying claimer cannot receive the refund", async () => {
        const { market, actor, dropId } = await loadFixture(liveDropFixture);
        await actor.configure(false, false, 0n);

        await expect(actor.claim(dropId, { value: PRICE * 2n }))
          .to.be.revertedWithCustomError(market, "RefundFailed")
          .withArgs(dropId);
        expect((await market.getDrop(dropId)).claimedUnits).to.equal(0n);
      });

      it("lets a claimer that rejects ETH claim with exact payment", async () => {
        const { market, actor, deployer, seller, dropId } = await loadFixture(liveDropFixture);
        await actor.configure(false, false, 0n);

        // The deployer funds the actor's call; the actor itself never receives anything back.
        await expect(actor.claim(dropId, { value: PRICE })).to.changeEtherBalances(
          [seller, deployer, actor, market],
          [PRICE, -PRICE, 0n, 0n],
        );
        expect(await market.claimedByWallet(dropId, await actor.getAddress())).to.equal(1n);
      });
    });

    describe("reentrancy", () => {
      it("blocks a seller re-entering claim from its payment hook", async () => {
        const { market, actor, alice } = await loadFixture(deployFixture);
        const p = await defaultParams();
        await actor.createDrop(
          p.metadataURI,
          p.price,
          p.totalUnits,
          p.startTime,
          p.endTime,
          p.maxPerWallet,
        );
        await actor.configure(true, true, 1n);
        await time.increaseTo(p.startTime);

        await expect(market.connect(alice).claim(1n, { value: PRICE }))
          .to.be.revertedWithCustomError(market, "SellerPaymentFailed")
          .withArgs(1n);
        expect((await market.getDrop(1n)).claimedUnits).to.equal(0n);
        expect(await marketBalance(market)).to.equal(0n);
      });

      it("blocks a claimer re-entering claim from its refund hook", async () => {
        const { market, actor, dropId } = await loadFixture(liveDropFixture);
        await actor.configure(true, true, dropId);

        await expect(actor.claim(dropId, { value: PRICE * 3n }))
          .to.be.revertedWithCustomError(market, "RefundFailed")
          .withArgs(dropId);
        expect((await market.getDrop(dropId)).claimedUnits).to.equal(0n);
        expect(await marketBalance(market)).to.equal(0n);
      });
    });
  });

  describe("closeDrop", () => {
    it("lets the seller close an active drop", async () => {
      const { market, seller, alice, dropId } = await loadFixture(liveDropFixture);

      await expect(market.connect(seller).closeDrop(dropId))
        .to.emit(market, "DropClosed")
        .withArgs(dropId);
      expect((await market.getDrop(dropId)).active).to.equal(false);
      expect(await market.isLive(dropId)).to.equal(false);

      await expect(market.connect(alice).claim(dropId, { value: PRICE }))
        .to.be.revertedWithCustomError(market, "DropInactive")
        .withArgs(dropId);
    });

    it("rejects anyone but the seller", async () => {
      const { market, alice, dropId } = await loadFixture(liveDropFixture);
      await expect(market.connect(alice).closeDrop(dropId))
        .to.be.revertedWithCustomError(market, "NotSeller")
        .withArgs(dropId);
    });

    it("rejects closing an unknown or already inactive drop", async () => {
      const { market, seller, dropId } = await loadFixture(liveDropFixture);
      await expect(market.connect(seller).closeDrop(99n))
        .to.be.revertedWithCustomError(market, "DropNotFound")
        .withArgs(99n);

      await market.connect(seller).closeDrop(dropId);
      await expect(market.connect(seller).closeDrop(dropId))
        .to.be.revertedWithCustomError(market, "DropInactive")
        .withArgs(dropId);
    });
  });

  describe("views", () => {
    it("getDrop reverts for unknown ids", async () => {
      const { market } = await loadFixture(deployFixture);
      await expect(market.getDrop(1n))
        .to.be.revertedWithCustomError(market, "DropNotFound")
        .withArgs(1n);
    });

    it("remaining and isLive report zero/false for unknown ids", async () => {
      const { market } = await loadFixture(deployFixture);
      expect(await market.remaining(7n)).to.equal(0n);
      expect(await market.isLive(7n)).to.equal(false);
    });

    it("isLive follows the drop lifecycle", async () => {
      const { market, seller } = await loadFixture(deployFixture);
      const p = await defaultParams();
      await create(market, seller, p);

      expect(await market.isLive(1n)).to.equal(false);
      await time.increaseTo(p.startTime);
      expect(await market.isLive(1n)).to.equal(true);
      await time.increaseTo(p.endTime + 1n);
      expect(await market.isLive(1n)).to.equal(false);
    });
  });

  describe("custody", () => {
    it("never holds ETH across a sequence of claims", async () => {
      const { market, alice, bob, carol, dropId } = await loadFixture(liveDropFixture);

      for (const [signer, value] of [
        [alice, PRICE],
        [bob, PRICE * 2n],
        [carol, PRICE + 1n],
      ] as const) {
        await market.connect(signer).claim(dropId, { value });
        expect(await marketBalance(market)).to.equal(0n);
      }
    });

    it("rejects plain ETH transfers", async () => {
      const { market, alice } = await loadFixture(deployFixture);
      await expect(alice.sendTransaction({ to: await market.getAddress(), value: PRICE })).to.be
        .reverted;
    });
  });
});
