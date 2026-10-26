import { BoltIcon, PlusIcon, WalletIcon } from "./Icons";

const STEPS = [
  {
    icon: PlusIcon,
    title: "A creator opens a drop",
    body: "They pick a name, a fixed price, how many units there are and when it opens and closes. One transaction puts it on-chain.",
  },
  {
    icon: BoltIcon,
    title: "Anyone taps Nab it",
    body: "Connect a wallet and tap. The app checks the claim first, so a sold-out drop tells you before you pay any gas.",
  },
  {
    icon: WalletIcon,
    title: "Payment goes straight to the creator, in milliseconds",
    body: "The contract forwards the price to the creator in the same transaction and refunds anything extra. You see the preconfirmation almost at once, then the sealed block.",
  },
] as const;

/** The three-step explainer, shared by the home page and /how-it-works. */
export function HowSteps() {
  return (
    <ol className="steps">
      {STEPS.map(({ icon: Icon, title, body }, index) => (
        <li key={title} className="step card">
          <span className="step-num mono" aria-hidden="true">
            {index + 1}
          </span>
          <Icon className="step-icon" width={26} height={26} />
          <h3 className="step-title">
            <span className="sr-only">Step {index + 1}: </span>
            {title}
          </h3>
          <p className="step-body">{body}</p>
        </li>
      ))}
    </ol>
  );
}
