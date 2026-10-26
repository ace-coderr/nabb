import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const config = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../../vercel.json", import.meta.url)), "utf8"),
) as { headers: { source: string; headers: { key: string; value: string }[] }[] };

const csp = config.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key === "Content-Security-Policy")!.value;

const directive = (name: string) =>
  csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];

describe("content security policy", () => {
  it("lets drop images load from this site, https hosts (incl. the ipfs gateway) and data URIs", () => {
    const img = directive("img-src");
    assert.ok(img.includes("'self'"), "same-site paths such as /drops/name.png");
    assert.ok(img.includes("https:"), "https:// and ipfs:// via an https gateway");
    assert.ok(img.includes("data:"), "data:image URIs");
    assert.ok(!img.includes("http:"), "never plain http");
  });

  it("keeps scripts to this site and forbids framing and plugins", () => {
    assert.deepEqual(directive("script-src"), ["'self'"]);
    assert.deepEqual(directive("frame-ancestors"), ["'none'"]);
    assert.deepEqual(directive("object-src"), ["'none'"]);
  });

  it("only talks to https endpoints", () => {
    assert.deepEqual(directive("connect-src"), ["'self'", "https:"]);
  });
});
