import { Link } from "react-router";
import { HowSteps } from "../components/HowSteps";
import { SpeedProof } from "../components/SpeedProof";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FAUCETS } from "../links";

const FAQ: readonly { question: string; answer: React.ReactNode }[] = [
  {
    question: "What is a drop?",
    answer: (
      <p>
        A drop is a limited run of identical units sold at one fixed price. A creator sets the name,
        the price, how many units exist, a per-wallet limit and the window in which claims are
        allowed. Each claim takes exactly one unit.
      </p>
    ),
  },
  {
    question: "What is Flashblocks?",
    answer: (
      <p>
        GIWA's sequencer builds each block and can publish the block in progress before it is
        sealed. That early view is called Flashblocks. Nabb reads your claim from it, so you see
        that the claim landed long before the sealed block exists.
      </p>
    ),
  },
  {
    question: 'Why is my claim "preconfirmed"?',
    answer: (
      <p>
        Preconfirmed means your claim is already inside the block the sequencer is building, but
        that block is not sealed yet. It is the sequencer's word that your claim is in. Final means
        the block has been sealed, and Nabb shows that as "Final in block N". You get both after
        every claim.
      </p>
    ),
  },
  {
    question: "What happens if a drop sells out mid-claim?",
    answer: (
      <p>
        Before you send anything, Nabb checks the claim against the latest state, so a drop that is
        already sold out tells you up front. If the last unit goes while your transaction is on its
        way, the contract rejects your claim and you keep your ETH; you only pay the network fee for
        the attempt. Nabb then shows that your claim reverted.
      </p>
    ),
  },
  {
    question: "How do I get test ETH?",
    answer: (
      <p>
        Free test ETH comes from a faucet:{" "}
        {FAUCETS.map((faucet, i) => (
          <span key={faucet.url}>
            {i > 0 && " or "}
            <a href={faucet.url} target="_blank" rel="noreferrer">
              {faucet.name}
            </a>
          </span>
        ))}
        . Add GIWA Sepolia to your wallet (Nabb offers to do it when you connect), request some ETH,
        and come back. A claim needs only the drop's price plus a tiny network fee.
      </p>
    ),
  },
  {
    question: "Is this real money?",
    answer: (
      <p>
        No. Nabb runs on GIWA Sepolia, a test network. The ETH you use has no monetary value, and
        nothing you nab here is worth real money. Read <Link to="/safety">Safety</Link> for what the
        contract does and does not do.
      </p>
    ),
  },
  {
    question: "How do I create a drop?",
    answer: (
      <p>
        Connect a wallet, open <Link to="/create">Create</Link>, fill in a name, price, number of
        units, per-wallet limit and closing time, then confirm one transaction. You land on the
        drop's page, ready to share. You can close a drop early from the drop page or from{" "}
        <Link to="/me">My activity</Link>.
      </p>
    ),
  },
];

export function HowItWorks() {
  useDocumentTitle(
    "How it works",
    "How Nabb works: creators open drops, anyone taps Nab it, and payment goes straight to the creator. Plus answers about Flashblocks and preconfirmation.",
  );
  return (
    <div className="container prose-page">
      <div className="page-head">
        <h1>How Nabb works</h1>
        <p className="muted">Three steps, one contract, and no middleman holding your money.</p>
      </div>

      <HowSteps />

      <section className="section" aria-labelledby="speed-title">
        <h2 id="speed-title">Why claims feel instant</h2>
        <p className="section-lede">
          Nabb confirms a claim in two stages. First it asks the Flashblocks endpoint whether your
          transaction is in the block being built. Then it waits for the sealed block from the
          standard endpoint and shows the final result. If the Flashblocks endpoint is slow or
          unavailable, Nabb falls back to the standard one, so a claim never depends on it.
        </p>
        <SpeedProof />
      </section>

      <section className="section" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        <div className="faq">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="faq-item card">
              <summary>{question}</summary>
              <div className="faq-answer">{answer}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="cta card">
        <h2>Ready to try it?</h2>
        <p className="section-lede">Browse what's live, or open a drop of your own.</p>
        <div className="cta-actions">
          <Link to="/drops" className="btn btn-primary btn-lg">
            Browse drops
          </Link>
          <Link to="/create" className="btn btn-lg">
            Create a drop
          </Link>
        </div>
      </section>
    </div>
  );
}
