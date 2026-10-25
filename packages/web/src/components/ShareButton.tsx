import { useEffect, useState } from "react";

/** Copies the current page URL; uses the native share sheet where one exists (mobile). */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(id);
  }, [copied]);

  async function share() {
    const url = window.location.href;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or unsupported — fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={() => void share()}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
