import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Adversarial behaviour of the deployed NabbMarket. These tests do not change the contract; they
 * document what hostile sellers, claimers and metadata can and cannot do. Each describe block says
 * whether the behaviour is by design or a known limitation.
 */

const PRICE = ethers.parseEther("0.01");
const MAX_U64 = 2n ** 64n - 1n;

async function window(startOffset = -60n, length = 3600n) {
  const now = BigInt(await time.latest());
  return { startTime: now + startOffset, endTime: now + length };
}

describe("NabbMarket audit", () => {
  async function fixture() {
    const [deployer, seller, alice, bob, carol, dave] = await ethers.getSigners();
    const market = await ethers.deployContract("NabbMarket");
    const hostile = await ethers.deployContract("HostileSeller", [await market.getAddress()]);
    return { market, hostile, deployer, seller, alice, bob, carol, dave };
  }

  async function createPlain(
    market: Awaited<ReturnType<typeof fixture>>["market"],
    seller: Awaited<ReturnType<typeof fixture>>["seller"],
    uri = "ipfs://x",
    totalUnits = 5n,
  ) {
    const { startTime, endTime } = await window();
    await market.connect(seller).createDrop(uri, PRICE, totalUnits, startTime, endTime, 5);
    return (await market.nextDropId()) - 1n;
  }

  describe("by design: limits are per address, not per person", () => {
    it("one person with several wallets can claim past maxPerWallet", async () => {
      const { market, seller, alice, bob, carol } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await market.connect(seller).createDrop("ipfs://x", PRICE, 10n, startTime, endTime, 1);

      for (const wallet of [alice, bob, carol]) {
        await market.connect(wallet).claim(1n, { value: PRICE });
      }
      expect((await market.getDrop(1n)).claimedUnits).to.equal(3n);
      // Each address is still held to its own limit.
      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "WalletLimitReached",
      );
    });
  });

  describe("by design: the seller controls who can pay it", () => {
    it("a seller that rejects ETH only blocks claims on its own drop", async () => {
      const { market, hostile, seller, alice } = await loadFixture(fixture);
      const mock = await ethers.deployContract("MarketActorMock", [await market.getAddress()]);
      const { startTime, endTime } = await window();
      await mock.createDrop("ipfs://bad", PRICE, 3n, startTime, endTime, 3);
      await mock.configure(false, false, 0n);
      void hostile;

      const goodId = await createPlain(market, seller);
      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "SellerPaymentFailed",
      );
      await expect(market.connect(alice).claim(goodId, { value: PRICE })).to.emit(
        market,
        "Claimed",
      );
    });

    it("a seller that closes its drop while being paid still completes that claim", async () => {
      const { market, hostile, alice, bob } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await hostile.createDrop("ipfs://x", PRICE, 5n, startTime, endTime, 5);
      await hostile.configure(3, 0n, 0n); // CloseSelf

      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.emit(market, "Claimed");
      const drop = await market.getDrop(1n);
      expect(drop.claimedUnits).to.equal(1n);
      expect(drop.active).to.equal(false);
      await expect(market.connect(bob).claim(1n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "DropInactive",
      );
    });

    it("a seller can close a drop before it opens", async () => {
      const { market, seller, alice } = await loadFixture(fixture);
      const { startTime, endTime } = await window(600n, 7200n);
      await market.connect(seller).createDrop("ipfs://x", PRICE, 5n, startTime, endTime, 2);
      await market.connect(seller).closeDrop(1n);
      await time.increaseTo(startTime);
      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "DropInactive",
      );
    });
  });

  describe("known limitation: a hostile seller can make claims on its own drop expensive", () => {
    it("a gas-burning seller still gets paid, and the claimer pays for the burn", async () => {
      const { market, hostile, alice, bob } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await hostile.createDrop("ipfs://x", PRICE, 5n, startTime, endTime, 5);

      const normal = await (await market.connect(alice).claim(1n, { value: PRICE })).wait();
      await hostile.configure(1, 2_000_000n, 0n); // BurnGas
      const burned = await (await market.connect(bob).claim(1n, { value: PRICE })).wait();

      expect(burned!.gasUsed - normal!.gasUsed).to.be.greaterThan(1_900_000n);
    });

    it("a claimer's gas limit protects it: too little gas reverts cleanly with no state change", async () => {
      const { market, hostile, alice } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await hostile.createDrop("ipfs://x", PRICE, 5n, startTime, endTime, 5);
      await hostile.configure(1, 2_000_000n, 0n);

      await expect(market.connect(alice).claim(1n, { value: PRICE, gasLimit: 500_000n }))
        .to.be.revertedWithCustomError(market, "SellerPaymentFailed")
        .withArgs(1n);
      expect((await market.getDrop(1n)).claimedUnits).to.equal(0n);
      expect(await market.claimedByWallet(1n, alice.address)).to.equal(0n);
    });

    it("a return-data bomb costs the claimer gas but cannot make the claim fail", async () => {
      const { market, hostile, alice, bob } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await hostile.createDrop("ipfs://x", PRICE, 5n, startTime, endTime, 5);

      const normal = await (await market.connect(alice).claim(1n, { value: PRICE })).wait();
      await hostile.configure(2, 0n, 500_000n); // ReturnBomb: 500 kB
      const bombed = await (await market.connect(bob).claim(1n, { value: PRICE })).wait();

      expect(bombed!.status).to.equal(1);
      expect(bombed!.gasUsed).to.be.greaterThan(normal!.gasUsed);
      expect((await market.getDrop(1n)).claimedUnits).to.equal(2n);
    });
  });

  describe("metadata abuse", () => {
    it("claims do not read metadataURI: a huge URI does not make claims dearer", async () => {
      const { market, seller, alice, bob } = await loadFixture(fixture);
      const small = await createPlain(market, seller, "ipfs://x");
      const huge = await createPlain(market, seller, "x".repeat(20_000));

      const a = await (await market.connect(alice).claim(small, { value: PRICE })).wait();
      const b = await (await market.connect(bob).claim(huge, { value: PRICE })).wait();
      expect(b!.gasUsed).to.be.closeTo(a!.gasUsed, 2_000n);
    });

    it("a very large URI is stored and returned in full — readers carry the cost (limitation)", async () => {
      const { market, seller } = await loadFixture(fixture);
      const uri = "y".repeat(20_000);
      const id = await createPlain(market, seller, uri);
      expect((await market.getDrop(id)).metadataURI).to.equal(uri);
    });

    it("an absurdly large URI cannot fit in one block", async () => {
      const { market, seller } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      let rejected = false;
      try {
        await market
          .connect(seller)
          .createDrop("z".repeat(400_000), PRICE, 1n, startTime, endTime, 1);
      } catch {
        rejected = true;
      }
      expect(rejected).to.equal(true);
    });

    it("hostile text is just data: markup and control characters round-trip untouched", async () => {
      const { market, seller } = await loadFixture(fixture);
      const uri =
        "data:text/html,<script>alert(1)</script>" + String.fromCharCode(0x202e) + "\u0000\"'";
      const id = await createPlain(market, seller, uri);
      expect((await market.getDrop(id)).metadataURI).to.equal(uri);
    });
  });

  describe("extreme values", () => {
    it("handles the largest unit count and the latest possible end time", async () => {
      const { market, seller, alice } = await loadFixture(fixture);
      const { startTime } = await window();
      await market.connect(seller).createDrop("ipfs://x", PRICE, MAX_U64, startTime, MAX_U64, 1);

      expect(await market.isLive(1n)).to.equal(true);
      await market.connect(alice).claim(1n, { value: PRICE });
      expect(await market.remaining(1n)).to.equal(MAX_U64 - 1n);
    });

    it("rejects an end time equal to the start time, and one that is not in the future", async () => {
      const { market, seller } = await loadFixture(fixture);
      const now = BigInt(await time.latest());
      await expect(
        market.connect(seller).createDrop("ipfs://x", PRICE, 1n, now + 100n, now + 100n, 1),
      ).to.be.revertedWithCustomError(market, "InvalidWindow");
      await expect(
        market.connect(seller).createDrop("ipfs://x", PRICE, 1n, 0n, now, 1),
      ).to.be.revertedWithCustomError(market, "InvalidWindow");
    });

    it("a maximum-price drop cannot be claimed without paying it in full", async () => {
      const { market, seller, alice } = await loadFixture(fixture);
      const { startTime, endTime } = await window();
      await market.connect(seller).createDrop("ipfs://x", 2n ** 255n, 1n, startTime, endTime, 1);
      await expect(market.connect(alice).claim(1n, { value: PRICE })).to.be.revertedWithCustomError(
        market,
        "InsufficientPayment",
      );
    });
  });

  describe("custody: the protocol never holds funds, but anyone can force-send ETH", () => {
    it("force-sent ETH is stuck, but never mixes with claim payments", async () => {
      const { market, seller, alice } = await loadFixture(fixture);
      const id = await createPlain(market, seller);

      const forced = ethers.parseEther("1");
      const sender = await ethers.deployContract("ForceSender", { value: forced });
      await sender.force(await market.getAddress());
      expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(forced);

      // A claim moves exactly `price` to the seller and refunds the rest; the stray ETH is untouched.
      await expect(market.connect(alice).claim(id, { value: PRICE * 3n })).to.changeEtherBalances(
        [seller, alice, market],
        [PRICE, -PRICE, 0n],
      );
      expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(forced);
    });
  });
});
