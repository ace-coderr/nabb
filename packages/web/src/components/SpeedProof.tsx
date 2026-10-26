/**
 * A static explainer of preconfirmation versus the sealed block. The readings below are examples
 * recorded on GIWA Sepolia testnet from Nigeria; they are not live figures and are not a promise.
 * They are kept as plain data so the table and the bars can never disagree.
 */
interface Reading {
  run: number;
  preconfirmMs: number;
  finalMs: number;
  /** How the final time is written, exactly as recorded. */
  finalLabel: string;
  note?: string;
}

const READINGS: readonly Reading[] = [
  { run: 1, preconfirmMs: 446, finalMs: 880, finalLabel: "0.88s" },
  { run: 2, preconfirmMs: 454, finalMs: 1750, finalLabel: "1.75s" },
  {
    run: 3,
    preconfirmMs: 494,
    finalMs: 496,
    finalLabel: "496ms",
    note: "The sealed block landed almost the moment the claim was preconfirmed. That was luck in block timing, not what to expect.",
  },
];

const AXIS_MS = Math.max(...READINGS.map((r) => r.finalMs));

const seconds = (ms: number) => `${(ms / 1000).toFixed(2).replace(/\.?0+$/, "")}s`;
const fmt = (ms: number) => (ms < 1000 ? `${ms}ms` : seconds(ms));
const gap = (r: Reading) => {
  const diff = r.finalMs - r.preconfirmMs;
  return diff < 10 ? `${diff}ms` : fmt(diff);
};

export function SpeedProof() {
  return (
    <figure className="proof">
      <figcaption className="proof-caption">
        <strong>Example readings</strong> from GIWA Sepolia testnet, measured from Nigeria. Your own
        numbers depend on your connection and on the network, so expect them to differ.
      </figcaption>
      <table className="proof-table">
        <caption className="sr-only">
          Preconfirmation time compared with final block time for three example claims
        </caption>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Preconfirmed</th>
            <th scope="col">Final block</th>
            <th scope="col" className="proof-bars-col">
              <span className="sr-only">Comparison</span>
            </th>
            <th scope="col">Gap</th>
          </tr>
        </thead>
        <tbody>
          {READINGS.map((reading) => (
            <tr key={reading.run}>
              <th scope="row">{reading.run}</th>
              <td className="speed-text">{fmt(reading.preconfirmMs)}</td>
              <td className="speed-text">{reading.finalLabel}</td>
              <td className="proof-bars-col" aria-hidden="true">
                <div className="proof-bar">
                  <span
                    className="proof-fill proof-fill-pre"
                    style={{ width: `${(reading.preconfirmMs / AXIS_MS) * 100}%` }}
                  />
                </div>
                <div className="proof-bar">
                  <span
                    className="proof-fill proof-fill-final"
                    style={{ width: `${(reading.finalMs / AXIS_MS) * 100}%` }}
                  />
                </div>
              </td>
              <td className="speed-text">{gap(reading)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="proof-notes muted small">
        {READINGS.filter((r) => r.note).map((r) => (
          <li key={r.run}>
            <strong>Run {r.run}:</strong> {r.note}
          </li>
        ))}
        <li>
          <strong>Preconfirmed</strong> means the claim is in the sequencer's block that is still
          being built. <strong>Final block</strong> is when that block is sealed. The app shows both
          after every claim.
        </li>
      </ul>
    </figure>
  );
}
