import { useState } from "react";
import { safeImageUrl } from "../lib/metadata";

/**
 * Live preview of the image address typed into the Create form. Shows nothing for an empty or
 * invalid address (the form's own validation explains those), a note while loading, and a clear
 * message if the address is valid but does not load as an image.
 */
export function ImagePreview({ value }: { value: string }) {
  const url = safeImageUrl(value);
  // Status is tied to the address it was measured for, so editing the field resets it.
  const [result, setResult] = useState<{ url: string; ok: boolean }>();
  if (!url) return null;
  const status = result?.url === url ? (result.ok ? "ok" : "error") : "loading";

  return (
    <div className="img-preview" aria-live="polite">
      {status !== "error" && (
        <img
          key={url}
          src={url}
          alt="Preview of the drop image"
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setResult({ url, ok: true })}
          onError={() => setResult({ url, ok: false })}
        />
      )}
      {status === "loading" && <span className="muted small">Loading preview…</span>}
      {status === "error" && (
        <span className="field-error">
          Couldn't load an image from that address. Check it, or leave it blank to get generated
          artwork.
        </span>
      )}
    </div>
  );
}
