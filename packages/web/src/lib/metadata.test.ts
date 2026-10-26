import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGE_URL_LENGTH,
  MAX_METADATA_CHARS,
  MAX_NAME_LENGTH,
  cleanDescription,
  cleanName,
  encodeMetadata,
  isSameSitePath,
  isValidImageInput,
  loadMetadata,
  normalizeMetadata,
  safeImageUrl,
} from "./metadata";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return calls;
}

describe("cleanName", () => {
  it("strips bidirectional overrides, zero-width and control characters", () => {
    assert.equal(
      cleanName(
        "Free" + String.fromCharCode(0x202e) + "ETH" + String.fromCharCode(0x200b) + "\u0000 pass",
      ),
      "FreeETH pass",
    );
    assert.equal(
      cleanName("" + String.fromCharCode(0x2066) + "hidden" + String.fromCharCode(0x2069) + ""),
      "hidden",
    );
  });

  it("collapses whitespace and newlines into one line", () => {
    assert.equal(cleanName("  a \n\n  b\t c  "), "a b c");
  });

  it("truncates long names by code point without splitting emoji", () => {
    const name = cleanName("🔥".repeat(500))!;
    assert.equal(Array.from(name).length, MAX_NAME_LENGTH);
    assert.ok(name.endsWith("…"));
    assert.ok(!name.includes("�"));
  });

  it("returns undefined for non-strings and for names with nothing visible", () => {
    assert.equal(cleanName(42), undefined);
    assert.equal(cleanName(null), undefined);
    assert.equal(
      cleanName("" + String.fromCharCode(0x200b) + "" + String.fromCharCode(0x202e) + "  \u0000"),
      undefined,
    );
  });

  it("leaves markup as plain text for React to escape", () => {
    assert.equal(cleanName("<img src=x onerror=alert(1)>"), "<img src=x onerror=alert(1)>");
  });
});

describe("cleanDescription", () => {
  it("keeps paragraph breaks but limits blank lines and removes control characters", () => {
    assert.equal(
      cleanDescription("one\r\n\r\n\r\n\r\ntwo\u0000" + String.fromCharCode(0x202e) + ""),
      "one\n\ntwo",
    );
  });

  it("truncates to the maximum length", () => {
    const text = cleanDescription("a".repeat(5_000))!;
    assert.equal(Array.from(text).length, MAX_DESCRIPTION_LENGTH);
  });

  it("returns undefined when empty", () => {
    assert.equal(cleanDescription("   \n  "), undefined);
    assert.equal(cleanDescription({}), undefined);
  });
});

describe("safeImageUrl", () => {
  it("accepts https, ipfs (via a gateway) and data images", () => {
    assert.equal(safeImageUrl("https://example.com/a.png"), "https://example.com/a.png");
    assert.equal(safeImageUrl("ipfs://bafy123/a.png"), "https://ipfs.io/ipfs/bafy123/a.png");
    assert.equal(safeImageUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
    assert.equal(safeImageUrl("DATA:IMAGE/PNG;base64,AAAA"), "DATA:IMAGE/PNG;base64,AAAA");
  });

  it("rejects script, markup, downgrade and malformed sources", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:application/javascript,alert(1)",
      "http://example.com/a.png",
      "//example.com/a.png",
      "file:///etc/passwd",
      "https://exa mple.com/a b.png",
      "vbscript:msgbox(1)",
      "",
      "   ",
    ]) {
      assert.equal(safeImageUrl(bad), undefined, bad);
    }
    assert.equal(safeImageUrl(undefined), undefined);
  });

  it("rejects absurdly long URLs", () => {
    assert.equal(
      safeImageUrl(`https://example.com/${"a".repeat(MAX_IMAGE_URL_LENGTH)}`),
      undefined,
    );
  });
});

describe("same-site image paths", () => {
  it("accepts simple site paths such as /drops/name.png", () => {
    for (const ok of ["/drops/name.png", "/og.png", "/a/b/c-d_e.f.webp", "/drops/my%20pic.png"]) {
      assert.equal(isSameSitePath(ok), true, ok);
      assert.equal(safeImageUrl(ok), ok, ok);
      assert.equal(isValidImageInput(ok), true, ok);
    }
  });

  it("rejects protocol-relative, traversal, scheme and odd paths", () => {
    for (const bad of [
      "//evil.com/x.png",
      "/../etc/passwd",
      "/drops/../../x",
      "/drops" + String.fromCharCode(92) + "x.png",
      "drops/name.png",
      "./name.png",
      "/drops/a b.png",
      "/drops/<x>.png",
      "/drops/x?y=1",
      "javascript:alert(1)",
      "/" + "a".repeat(MAX_IMAGE_URL_LENGTH),
    ]) {
      assert.equal(isSameSitePath(bad), false, bad);
      assert.equal(safeImageUrl(bad), undefined, bad);
      assert.equal(isValidImageInput(bad), false, bad);
    }
  });
});

describe("isValidImageInput (create form)", () => {
  it("allows https and ipfs only", () => {
    assert.equal(isValidImageInput("https://example.com/a.png"), true);
    assert.equal(isValidImageInput("ipfs://bafy/a.png"), true);
    assert.equal(isValidImageInput("http://example.com/a.png"), false);
    assert.equal(isValidImageInput("javascript:alert(1)"), false);
    assert.equal(isValidImageInput("https://a.com/ b"), false);
  });
});

describe("normalizeMetadata", () => {
  it("falls back for anything that is not a plain object", () => {
    for (const raw of [null, undefined, 7, "str", [], [{ name: "x" }]]) {
      assert.deepEqual(normalizeMetadata(raw, "Drop #1"), { name: "Drop #1" });
    }
  });

  it("ignores wrongly typed fields and drops unsafe images", () => {
    const meta = normalizeMetadata(
      { name: 123, description: { a: 1 }, image: "javascript:alert(1)" },
      "Drop #2",
    );
    assert.deepEqual(meta, { name: "Drop #2", description: undefined, image: undefined });
  });

  it("cleans every field", () => {
    const meta = normalizeMetadata(
      {
        name: "" + String.fromCharCode(0x202e) + "Evil",
        description: "x\u0000y",
        image: "https://e.com/i.png",
      },
      "Drop #3",
    );
    assert.deepEqual(meta, { name: "Evil", description: "xy", image: "https://e.com/i.png" });
  });
});

describe("loadMetadata", () => {
  it("round-trips metadata the app encodes", async () => {
    const uri = encodeMetadata({
      name: "Genesis",
      description: "Hello ⚡",
      image: "https://e.com/i.png",
    });
    assert.deepEqual(await loadMetadata(uri, "Drop #1"), {
      name: "Genesis",
      description: "Hello ⚡",
      image: "https://e.com/i.png",
    });
  });

  it("falls back on malformed data URIs and invalid JSON", async () => {
    const calls = stubFetch(() => {
      throw new Error("must not fetch");
    });
    for (const uri of [
      "data:application/json;base64,!!!not-base64!!!",
      "data:application/json;base64,bm90IGpzb24=", // "not json"
      "data:nocomma",
      "data:application/json,%E0%A4%A",
    ]) {
      assert.deepEqual(await loadMetadata(uri, "Drop #4"), { name: "Drop #4" }, uri);
    }
    assert.equal(calls.length, 0);
  });

  it("refuses to parse a huge data URI", async () => {
    const uri = `data:application/json;base64,${"A".repeat(MAX_METADATA_CHARS + 1)}`;
    assert.deepEqual(await loadMetadata(uri, "Drop #5"), { name: "Drop #5" });
  });

  it("never fetches non-https schemes", async () => {
    const calls = stubFetch(() => {
      throw new Error("must not fetch");
    });
    for (const uri of [
      "javascript:alert(1)",
      "http://example.com/m.json",
      "file:///etc/passwd",
      "ftp://x/y",
      "",
      "not a uri",
    ]) {
      assert.deepEqual(await loadMetadata(uri, "Drop #6"), { name: "Drop #6" }, uri);
    }
    assert.equal(calls.length, 0);
  });

  it("fetches https JSON without cookies or referrer and cleans it", async () => {
    let init: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, options?: RequestInit) => {
      init = options;
      return new Response(
        JSON.stringify({ name: " " + String.fromCharCode(0x202e) + "Remote ", description: "d" }),
      );
    }) as typeof fetch;
    assert.deepEqual(await loadMetadata("https://example.com/m.json", "Drop #7"), {
      name: "Remote",
      description: "d",
      image: undefined,
    });
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.referrerPolicy, "no-referrer");
  });

  it("resolves ipfs:// through the gateway", async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ name: "Pinned" })));
    assert.equal((await loadMetadata("ipfs://bafyabc/meta.json", "Drop #8")).name, "Pinned");
    assert.deepEqual(calls, ["https://ipfs.io/ipfs/bafyabc/meta.json"]);
  });

  it("rejects remote documents over the size limit, declared or streamed", async () => {
    stubFetch(
      () => new Response("{}", { headers: { "content-length": String(MAX_METADATA_CHARS + 1) } }),
    );
    assert.deepEqual(await loadMetadata("https://example.com/big.json", "Drop #9"), {
      name: "Drop #9",
    });

    stubFetch(() => new Response(`{"name":"${"a".repeat(MAX_METADATA_CHARS * 2)}"}`));
    assert.deepEqual(await loadMetadata("https://example.com/stream.json", "Drop #10"), {
      name: "Drop #10",
    });
  });

  it("falls back on HTTP errors, network errors and non-JSON bodies", async () => {
    stubFetch(() => new Response("nope", { status: 500 }));
    assert.equal((await loadMetadata("https://example.com/a", "Drop #11")).name, "Drop #11");
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    assert.equal((await loadMetadata("https://example.com/a", "Drop #12")).name, "Drop #12");
    stubFetch(() => new Response("<html>not json</html>"));
    assert.equal((await loadMetadata("https://example.com/a", "Drop #13")).name, "Drop #13");
  });
});
