/**
 * Drop metadata lives behind the drop's `metadataURI`. Drops created in the app embed it as a
 * base64 `data:` URI so nothing needs pinning; `ipfs://` and `https://` JSON are also understood.
 *
 * Everything here is attacker-controlled (anyone can create a drop with any string), so it is
 * size-limited, stripped of invisible/control/bidirectional characters, and only ever rendered as
 * text or as an <img> source.
 */
export interface DropMetadata {
  name: string;
  description?: string;
  image?: string;
}

export const MAX_NAME_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_IMAGE_URL_LENGTH = 2_048;
/** Largest metadata document (data URI or fetched JSON) that will be parsed. */
export const MAX_METADATA_CHARS = 65_536;

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

/**
 * A path on this site, such as `/drops/name.png`: one leading slash, no scheme, no protocol-relative
 * `//host`, no backslashes, no `..` segments and only URL-safe characters.
 */
export function isSameSitePath(value: string): boolean {
  return (
    value.length <= MAX_IMAGE_URL_LENGTH &&
    /^\/(?!\/)[A-Za-z0-9._~%/-]*$/.test(value) &&
    !value.split("/").includes("..")
  );
}

/**
 * Only allow image sources that cannot run script or be downgraded to plain http: https URLs,
 * ipfs:// (through a gateway), data: images and same-site paths.
 */
export function safeImageUrl(url: string | undefined): string | undefined {
  if (!url || url.length > MAX_METADATA_CHARS) return undefined;
  const trimmed = url.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (isSameSitePath(trimmed)) return trimmed;
  const resolved = resolveUri(trimmed);
  if (resolved.length > MAX_IMAGE_URL_LENGTH) return undefined;
  return /^https:\/\/[^\s]+$/i.test(resolved) ? resolved : undefined;
}

/** What the Create form accepts: https://, ipfs:// or a same-site path like /drops/name.png. */
export function isValidImageInput(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length > MAX_IMAGE_URL_LENGTH) return false;
  return /^(https:\/\/|ipfs:\/\/)\S+$/i.test(trimmed) || isSameSitePath(trimmed);
}

// Control characters, zero-width characters, line/paragraph separators and every bidirectional
// override/isolate: none of them belong in a name, and they are used to spoof or hide text.
// Built from numeric ranges so the source contains no invisible characters itself.
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];

function characterClass(ranges: readonly (readonly [number, number])[]): RegExp {
  const body = ranges
    .map(([from, to]) => String.fromCharCode(from) + "-" + String.fromCharCode(to))
    .join("");
  return new RegExp("[" + body + "]", "g");
}

const INVISIBLE = characterClass(INVISIBLE_RANGES);
// The same set, minus newline, for multi-line text.
const INVISIBLE_KEEP_NEWLINE = characterClass([
  [0x00, 0x09],
  [0x0b, 0x1f],
  ...INVISIBLE_RANGES.slice(1),
]);

function truncate(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join("")}…`;
}

/** A one-line, display-safe name, or undefined if nothing usable is left. */
export function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  return text ? truncate(text, MAX_NAME_LENGTH) : undefined;
}

/** A display-safe description that keeps paragraph breaks, or undefined. */
export function cleanDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE_KEEP_NEWLINE, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? truncate(text, MAX_DESCRIPTION_LENGTH) : undefined;
}

export function normalizeMetadata(raw: unknown, fallbackName: string): DropMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { name: fallbackName };
  const obj = raw as Record<string, unknown>;
  return {
    name: cleanName(obj.name) ?? fallbackName,
    description: cleanDescription(obj.description),
    image: typeof obj.image === "string" ? safeImageUrl(obj.image) : undefined,
  };
}

function parseDataUri(uri: string): unknown {
  const comma = uri.indexOf(",");
  if (comma === -1) throw new Error("Malformed data URI");
  const header = uri.slice(0, comma);
  const body = uri.slice(comma + 1);
  return JSON.parse(header.endsWith(";base64") ? fromBase64(body) : decodeURIComponent(body));
}

/** Reads a response body as text, giving up as soon as it exceeds `max` characters. */
async function readCapped(response: Response, max: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new Error("Metadata too large");
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > max) throw new Error("Metadata too large");
    return text;
  }
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    text += decoder.decode(value, { stream: true });
    if (text.length > max) {
      await reader.cancel();
      throw new Error("Metadata too large");
    }
  }
}

export async function loadMetadata(uri: string, fallbackName: string): Promise<DropMetadata> {
  try {
    if (uri.length > MAX_METADATA_CHARS && uri.startsWith("data:")) return { name: fallbackName };
    if (uri.startsWith("data:")) return normalizeMetadata(parseDataUri(uri), fallbackName);
    const url = resolveUri(uri);
    if (url.length > MAX_IMAGE_URL_LENGTH || !/^https:\/\//i.test(url)) {
      return { name: fallbackName };
    }
    // No cookies, no referrer: the creator's host learns nothing about the visitor's session.
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return { name: fallbackName };
    return normalizeMetadata(
      JSON.parse(await readCapped(response, MAX_METADATA_CHARS)),
      fallbackName,
    );
  } catch {
    return { name: fallbackName };
  }
}
