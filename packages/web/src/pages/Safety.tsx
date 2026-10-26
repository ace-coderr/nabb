import { Link } from "react-router";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOY_BLOCK,
  CONTRACT_SOURCE_URL,
  CONTRACT_URL,
  GITHUB_URL,
} from "../links";

export function Safety() {
  useDocumentTitle(
    "Safety",
    "How Nabb handles funds: the contract pays the creator in the same transaction and never holds ETH. Contract address, chain id, verified source and known limitations.",
  );
  return (
    <div className="container prose-page">
      <div className="page-head">
        <h1>Safety</h1>
        <p className="muted">What the contract does with your money, and what it can't promise.</p>
      </div>

      <section className="section" aria-labelledby="custody-title">
        <h2 id="custody-title">Non-custodial, plainly</h2>
        <p className="section-lede">
          Nabb never holds your funds. When you claim a drop, the contract sends the price to the
          creator inside that same transaction and returns anything you sent on top. Nothing is left
          sitting in the contract, so there is no pool of money to steal and no withdrawal step. If
          the payment to the creator fails, the whole claim is undone and you keep your ETH.
        </p>
      </section>

      <section className="section card facts" aria-labelledby="contract-title">
        <h2 id="contract-title">The deployed contract</h2>
        <dl className="facts-list">
          <div>
            <dt>Network</dt>
            <dd>GIWA Sepolia (test network)</dd>
          </div>
          <div>
            <dt>Chain id</dt>
            <dd className="mono">{CHAIN_ID}</dd>
          </div>
          <div>
            <dt>NabbMarket address</dt>
            <dd className="mono wrap">
              <a href={CONTRACT_URL} target="_blank" rel="noreferrer">
                {CONTRACT_ADDRESS}
              </a>
            </dd>
          </div>
          <div>
            <dt>Deployed in block</dt>
            <dd className="mono">{CONTRACT_DEPLOY_BLOCK.toString()}</dd>
          </div>
        </dl>
        <div className="facts-links">
          <a href={CONTRACT_SOURCE_URL} target="_blank" rel="noreferrer" className="btn">
            Read the verified source ↗
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="link-quiet">
            Project on GitHub ↗
          </a>
        </div>
      </section>

      <section className="section" aria-labelledby="limits-title">
        <h2 id="limits-title">Known limitations</h2>
        <p className="section-lede">Honest edges, so nothing here surprises you.</p>
        <ul className="limits">
          <li>
            <strong>Testnet only.</strong> Nabb runs on GIWA Sepolia. The ETH is free and worth
            nothing, and the contract has not been professionally audited.
          </li>
          <li>
            <strong>Per-wallet limits are per address.</strong> A drop limits how many units one
            address can claim. Someone with several wallets can claim more; the contract cannot tell
            that they belong to one person.
          </li>
          <li>
            <strong>A creator can close a drop.</strong> The creator can stop their drop at any
            time. Units already claimed stay claimed, and nobody can change a drop's price.
          </li>
          <li>
            <strong>A creator controls its own payment address.</strong> If a creator's address
            refuses ETH, claims on that drop fail and cost you only the network fee. A creator's
            contract could also make claims on its own drop cost more network fee than usual, so
            check the fee your wallet shows before signing.
          </li>
          <li>
            <strong>Drop details are written by the creator.</strong> Names, descriptions and images
            come from whoever opened the drop. Nabb strips hidden characters and limits what it
            loads, but judge a drop by its creator, not its picture.
          </li>
        </ul>
      </section>

      <section className="cta card">
        <h2>Still have questions?</h2>
        <p className="section-lede">The how-it-works page answers the common ones.</p>
        <Link to="/how-it-works" className="btn btn-lg">
          How it works
        </Link>
      </section>
    </div>
  );
}
