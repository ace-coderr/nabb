/**
 * Drop metadata lives behind the drop's `metadataURI`. Drops created in the app embed it as a
 * base64 `data:` URI so nothing needs pinning; `ipfs://` and `https://` JSON are also understood.
 */
export interface DropMetadata {
  name: string;
  description?: string;
  image?: string;
}

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function toBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

export function encodeMetadata(metadata: DropMetadata): string {
  const clean: DropMetadata = { name: metadata.name.trim() };
  if (metadata.description?.trim()) clean.description = metadata.description.trim();
  if (metadata.image?.trim()) clean.image = metadata.image.trim();
  return `data:application/json;base64,${toBase64(JSON.stringify(clean))}`;
}

export function resolveUri(uri: string): string {
  return uri.startsWith("ipfs://") ? IPFS_GATEWAY + uri.slice("ipfs://".length) : uri;
}

/** Only allow image sources that can't run script. */
export function safeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const resolved = resolveUri(url.trim());
  return /^(https?:\/\/|data:image\/)/i.test(resolved) ? resolved : undefined;
}

export function isValidImageInput(url: string): boolean {
  return /^(https?:\/\/|ipfs:\/\/)\S+$/i.test(url.trim());
}

function normalize(raw: unknown, fallbackName: string): DropMetadata {
  if (!raw || typeof raw !== "object") return { name: fallbackName };
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    name: str(obj.name) ?? fallbackName,
    description: str(obj.description),
    image: safeImageUrl(str(obj.image)),
  };
}

function parseDataUri(uri: string): unknown {
  const comma = uri.indexOf(",");
  if (comma === -1) throw new Error("Malformed data URI");
  const header = uri.slice(0, comma);
  const body = uri.slice(comma + 1);
  return JSON.parse(header.endsWith(";base64") ? fromBase64(body) : decodeURIComponent(body));
}

export async function loadMetadata(uri: string, fallbackName: string): Promise<DropMetadata> {
  try {
    if (uri.startsWith("data:")) return normalize(parseDataUri(uri), fallbackName);
    const url = resolveUri(uri);
    if (!/^https?:\/\//i.test(url)) return { name: fallbackName };
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return { name: fallbackName };
    return normalize(await response.json(), fallbackName);
  } catch {
    return { name: fallbackName };
  }
}
